#!/usr/bin/env python3
"""Inspect or fetch one pinned APK; never extract or execute application code.

The frozen contract and this verifier require independent review and workflow pins.
Draft-release token readability is deliberately not assumed: a denial stops here.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import zipfile

REPOSITORY = "tmginstall1-dotcom/tmg-install"
BRANCH = "refs/heads/codex/staff-operations-2026-10-20"
PACKAGE = "com.tmginstall.staff"
SIGNER = "bc68524e65ed0d6c147a4bf736b3a609708f73042f558c429128120a1174a484"
MAX_APK = 50 * 1024 * 1024
REPOSITORY_APK_PATH = "build-inputs/tmg-staff-reviewed-unsigned.apk"
MARKER_GROUPS = {"checklist_recovery", "admin_close_preserved", "higher_version_update_only"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_contract(path):
    c = json.loads(Path(path).read_text(encoding="utf-8"))
    require(c.get("frozen") is True, "Contract is not independently frozen.")
    require(re.fullmatch(r"[0-9a-f]{40}", c.get("source_commit", "")), "Final source commit is missing.")
    require(re.fullmatch(r"[0-9a-f]{64}", c.get("unsigned_sha256", "")), "Final unsigned APK hash is missing.")
    require(c.get("transfer_kind") in {"draft_release_asset", "repository_apk"}, "Unknown frozen transfer kind.")
    if c["transfer_kind"] == "draft_release_asset":
        require(all(isinstance(c.get(k), str) and re.fullmatch(r"[1-9][0-9]{0,17}", c[k])
                    for k in ["draft_release_id", "unsigned_asset_id"]), "Final draft release/asset IDs are missing.")
    else:
        require(c.get("repository_apk_path") == REPOSITORY_APK_PATH, "Repository APK path differs from the exact reviewed path.")
    require(re.fullmatch(r"1\.4\.[0-9]{8}\.[0-9]+", c.get("expected_version_name", "")), "Invalid final version name.")
    require(type(c.get("expected_version_code")) is int and
            type(c.get("minimum_previous_version_code")) is int and
            2026102405 <= c["minimum_previous_version_code"] < c["expected_version_code"] <= 2100000000,
            "Version must be above the public APK and reviewed .5 candidate.")
    require(c.get("expected_min_sdk") == 24 and c.get("expected_target_sdk") == 33,
            "SDK configuration changed; separate native review is required.")
    require(c.get("expected_api_base") == "https://tmginstall.com", "Unexpected API base.")
    groups = c.get("required_markers")
    require(isinstance(groups, dict) and set(groups) == MARKER_GROUPS, "All three repair marker groups are required.")
    for markers in groups.values():
        require(isinstance(markers, list) and 1 <= len(markers) <= 10 and
                all(isinstance(m, str) and 8 <= len(m) <= 500 and "__FINAL" not in m for m in markers),
                "A final repair marker is missing.")
    pins = c.get("payload_entry_sha256")
    require(isinstance(pins, dict) and 2 <= len(pins) <= 20, "Pin the final job and dashboard payload entries.")
    for name, digest in pins.items():
        require(name.startswith("assets/public/assets/") and name.endswith(".js") and "__FINAL" not in name and
                re.fullmatch(r"[0-9a-f]{64}", digest or ""), "Final bundled payload hash is missing.")
    return c


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def github_json(path, token):
    req = urllib.request.Request("https://api.github.com/repos/" + REPOSITORY + path, headers={
        "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "TMG-APK-review"})
    with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
        body = response.read(2 * 1024 * 1024 + 1)
    require(len(body) <= 2 * 1024 * 1024, "GitHub metadata is unexpectedly large.")
    return json.loads(body)


def fetch_draft(release_id, asset_id, contract, output):
    require(contract.get("transfer_kind") == "draft_release_asset", "Frozen contract does not authorize draft transfer.")
    require(re.fullmatch(r"[1-9][0-9]{0,17}", release_id) and
            re.fullmatch(r"[1-9][0-9]{0,17}", asset_id), "Use numeric release and asset IDs.")
    require(release_id == contract["draft_release_id"] and asset_id == contract["unsigned_asset_id"],
            "Transfer IDs differ from the frozen approved input.")
    require(os.environ.get("GITHUB_REPOSITORY") == REPOSITORY and os.environ.get("GITHUB_REF") == BRANCH,
            "Wrong repository or branch.")
    token = os.environ.get("GITHUB_TOKEN", "")
    require(token, "Read-only workflow token is unavailable.")
    release = github_json("/releases/" + release_id, token)
    require(release.get("draft") is True and str(release.get("id")) == release_id,
            "Transfer release must remain a draft.")
    assets = github_json("/releases/" + release_id + "/assets?per_page=100", token)
    matches = [a for a in assets if str(a.get("id")) == asset_id]
    require(len(matches) == 1, "Asset is not in the exact draft release (first 100 assets only).")
    a = matches[0]
    require(a.get("state") == "uploaded" and 0 < a.get("size", 0) <= MAX_APK,
            "Asset is not a bounded completed upload.")
    require(str(a.get("name", "")).endswith(".apk"), "Transfer only one unsigned APK.")
    if a.get("digest"):
        require(a["digest"] == "sha256:" + contract["unsigned_sha256"], "Asset metadata hash differs from independent pin.")
    url = "https://api.github.com/repos/" + REPOSITORY + "/releases/assets/" + asset_id
    opener = urllib.request.build_opener(NoRedirect)
    for attempt in range(5):
        parsed = urllib.parse.urlparse(url)
        require(parsed.scheme == "https" and parsed.hostname in {
            "api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"},
            "Unexpected binary download host.")
        headers = {"Accept": "application/octet-stream", "User-Agent": "TMG-APK-review"}
        # Never forward the repository token to a signed object-storage redirect.
        if parsed.hostname == "api.github.com":
            headers["Authorization"] = "Bearer " + token
        try:
            response = opener.open(urllib.request.Request(url, headers=headers), timeout=60)
        except urllib.error.HTTPError as error:
            if error.code in {301, 302, 303, 307, 308}:
                url = urllib.parse.urljoin(url, error.headers["Location"])
                continue
            raise ValueError("Draft binary access denied or unavailable (HTTP " + str(error.code) + "). No keys loaded.") from None
        with response:
            data = response.read(MAX_APK + 1)
        require(len(data) == a["size"] and len(data) <= MAX_APK and data.startswith(b"PK"), "APK size/format differs from metadata.")
        require(sha(data) == contract["unsigned_sha256"], "Downloaded APK differs from independent hash.")
        require(not Path(output).exists() and not Path(output).is_symlink(), "Refusing to replace a local input.")
        Path(output).write_bytes(data)
        return {"release_id": int(release_id), "asset_id": int(asset_id), "draft": True,
                "bytes": len(data), "unsigned_sha256": sha(data)}
    raise ValueError("Too many binary redirects. No keys loaded.")


def zip_payload(path):
    require(Path(path).is_file() and not Path(path).is_symlink() and 0 < Path(path).stat().st_size <= MAX_APK, "APK size is invalid.")
    hashes, scripts, total, seen = {}, {}, 0, set()
    with zipfile.ZipFile(path) as z:
        require(len(z.infolist()) <= 15000, "Too many APK entries.")
        for entry in z.infolist():
            name = entry.filename
            require(name not in seen and not name.startswith("/") and "\\" not in name and
                    ".." not in PurePosixPath(name).parts and not (entry.flag_bits & 1), "Unsafe, duplicate or encrypted APK entry.")
            seen.add(name)
            require(not stat.S_ISLNK(entry.external_attr >> 16), "APK symlink is forbidden.")
            parts = {part.lower() for part in PurePosixPath(name).parts}
            require(not parts.intersection({"server", "attached_assets", "uploads", ".git", "secrets", "customer-data"}) and
                    not any(part.startswith(".env") for part in parts) and
                    PurePosixPath(name).suffix.lower() not in {
                        ".ts", ".tsx", ".jsx", ".map", ".tar", ".tgz", ".gz", ".zip", ".apk", ".aab",
                        ".keystore", ".jks", ".pem", ".key", ".sql", ".sqlite", ".db"},
                    "Source archive, source map, private data or key-like payload is forbidden.")
            total += entry.file_size
            require(entry.file_size <= 64 * 1024 * 1024 and total <= 256 * 1024 * 1024, "APK expands beyond bounds.")
            data = z.read(entry)
            # Android signature metadata is the only allowed entry-payload change.
            if not re.fullmatch(r"META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC))", name, re.I):
                hashes[name] = sha(data)
            if name.startswith("assets/public/assets/") and name.endswith(".js"):
                require(b"sourceMappingURL=data:" not in data, "Inline source map is forbidden.")
                scripts[name] = data
        require("AndroidManifest.xml" in hashes and "classes.dex" in hashes and scripts, "Missing Android or bundled UI payload.")
        config = json.loads(z.read("assets/capacitor.config.json"))
        require(config.get("appId") == PACKAGE and not config.get("server", {}).get("url"),
                "Expected bundled Capacitor UI; remote UI configuration is forbidden.")
    return hashes, scripts


def check_badging(text, c):
    line = next((line for line in text.splitlines() if line.startswith("package: ")), "")
    fields = dict(re.findall(r"(\w+)='([^']*)'", line))
    require(fields.get("name") == PACKAGE and fields.get("versionName") == c["expected_version_name"] and
            fields.get("versionCode") == str(c["expected_version_code"]), "APK package/version differs from frozen contract.")
    for key, expected in [("sdkVersion", c["expected_min_sdk"]), ("targetSdkVersion", c["expected_target_sdk"])]:
        require(re.search(r"(?m)^" + key + r":'" + str(expected) + r"'\s*$", text), "APK SDK differs from contract.")
    require("application-debuggable" not in text, "Debug APK cannot be signed as a release.")


def inspect_apk(path, c, aapt, original=None, apksigner=None, aligned=False):
    digest = sha(Path(path).read_bytes())
    if original is None:
        require(digest == c["unsigned_sha256"], "Unsigned APK differs from frozen contract.")
    hashes, scripts = zip_payload(path)
    if original is not None:
        require(sha(Path(original).read_bytes()) == c["unsigned_sha256"], "Original unsigned APK changed after approval.")
        require(hashes == zip_payload(original)[0], "Signing/alignment changed non-signature APK entry payloads.")
    require(not aligned or original is not None, "Aligned inspection requires the approved original.")
    for name, expected in c["payload_entry_sha256"].items():
        require(hashes.get(name) == expected, "Final bundled payload entry differs: " + name)
    hits = {}
    for group, markers in c["required_markers"].items():
        hits[group] = []
        for marker in markers:
            found = [name for name, data in scripts.items() if marker.encode() in data]
            require(found, "Required final repair marker is absent: " + group)
            hits[group] += found
    require(any(c["expected_api_base"].encode() in data for data in scripts.values()), "Live API base marker is absent.")
    baked = ("v" + c["expected_version_name"]).encode()
    require(any(baked in data for data in scripts.values()), "Bundled update version differs from Android version.")
    badging = subprocess.check_output([aapt, "dump", "badging", str(path)], text=True, stderr=subprocess.PIPE)
    check_badging(badging, c)
    if original is None or aligned:
        require(apksigner, "Unsigned-state verifier is required before loading keys.")
        unsigned = subprocess.run([apksigner, "verify", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        require(unsigned.returncode != 0, "Input already has a valid signature; an unsigned build is required.")
    report = {"source_commit": c["source_commit"], "package": PACKAGE, "version_name": c["expected_version_name"],
              "version_code": c["expected_version_code"], "sha256": digest, "bytes": Path(path).stat().st_size,
              "payload_entries": len(hashes), "payload_digest": sha(json.dumps(hashes, sort_keys=True).encode()),
              "repair_marker_groups": {k: sorted(set(v)) for k, v in hits.items()}, "api_base": c["expected_api_base"],
              "application_source_executed": False, "native_runtime_tested": False}
    if original is not None:
        report.update({"payload_unchanged": True, "unsigned_sha256": c["unsigned_sha256"]})
    if original is not None and not aligned:
        require(apksigner, "Signature verifier is required.")
        text = subprocess.check_output([apksigner, "verify", "--verbose", "--print-certs", str(path)], text=True, stderr=subprocess.PIPE)
        certs = re.findall(r"(?m)^Signer #\d+ certificate SHA-256 digest:\s*([0-9a-fA-F:]+)\s*$", text)
        require([s.replace(":", "").lower() for s in certs] == [SIGNER], "Existing signing certificate does not match.")
        report.update({"signer_certificate_sha256": SIGNER, "payload_unchanged": True, "signature_verified": True,
                       "unsigned_sha256": c["unsigned_sha256"]})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["fetch-draft", "inspect"])
    parser.add_argument("--contract", required=True)
    parser.add_argument("--apk", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--release-id")
    parser.add_argument("--asset-id")
    parser.add_argument("--aapt")
    parser.add_argument("--original")
    parser.add_argument("--apksigner")
    parser.add_argument("--aligned", action="store_true", help="Inspect aligned unsigned bytes before loading keys")
    args = parser.parse_args()
    try:
        c = load_contract(args.contract)
        if args.command == "fetch-draft":
            report = fetch_draft(args.release_id or "", args.asset_id or "", c, args.apk)
        else:
            require(args.aapt, "Pinned Android build-tool path is required.")
            report = inspect_apk(args.apk, c, args.aapt, args.original, args.apksigner, args.aligned)
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print("Read-only APK check passed; report saved.")
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        # Do not log HTTP URLs, redirect signatures, headers or tool output.
        print("APK check refused: " + (str(error) if isinstance(error, ValueError) else type(error).__name__))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
