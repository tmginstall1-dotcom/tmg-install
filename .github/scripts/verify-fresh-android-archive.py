#!/usr/bin/env python3
"""Read-only integrity preflight for a separately reviewed frozen Android archive.

No extraction, source execution, dependency install, build, network or publication.
Hashes passed on the command line must come from independent review, not the tar.
"""
import argparse
import hashlib
import json
import pathlib
import re
import tarfile

MANIFEST = "ANDROID_BUILD_INPUT_MANIFEST.json"
CHECKSUMS = "android-build-inputs.sha256"
PACKAGE = "com.tmginstall.staff"
SIGNER = "bc68524e65ed0d6c147a4bf736b3a609708f73042f558c429128120a1174a484"
FIXED = {
    "package.json", "package-lock.json", "vite.config.ts", "tsconfig.json",
    "tailwind.config.ts", "postcss.config.js", "capacitor.config.ts",
    "client/index.html", ".github/workflows/build-android.yml",
    "android/build.gradle", "android/settings.gradle", "android/variables.gradle",
    "android/gradle.properties", "android/capacitor.settings.gradle",
    "android/gradlew", "android/gradlew.bat", "android/app/build.gradle",
    "android/app/capacitor.build.gradle", "android/app/proguard-rules.pro",
    "android/app/google-services.json", "docs/android-staff-build-handoff.md",
}
PREFIXES = ("client/src/", "client/public/", "shared/", "android/gradle/wrapper/", "android/app/src/main/")
REQUIRED = {
    "package.json", "package-lock.json", "vite.config.ts", "capacitor.config.ts",
    "client/index.html", "client/src/pages/staff/JobDetail.tsx",
    "client/src/pages/staff/Dashboard.tsx", "client/src/hooks/use-quotes.ts",
    "android/app/build.gradle", "android/app/src/main/AndroidManifest.xml",
    "android/app/google-services.json", "android/gradlew",
    "android/gradle/wrapper/gradle-wrapper.jar", "android/gradle/wrapper/gradle-wrapper.properties",
}
DENIED_PARTS = {
    "uploads", "attached_assets", "tests", "test", "androidtest", "node_modules",
    ".git", ".ssh", ".aws", ".codex", "build", "generated-artifacts", "private",
    "customer-data", "credentials", "secrets", "backups", "dumps", ".gradle",
}
DENIED_SUFFIXES = {
    ".keystore", ".jks", ".b64", ".p12", ".pfx", ".pem", ".key", ".apk", ".aab",
    ".sql", ".pdf", ".csv", ".zip", ".gz", ".sqlite", ".db", ".dump", ".bak", ".log",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def unique_object(pairs):
    value = {}
    for key, child in pairs:
        if key in value:
            raise ValueError("Duplicate JSON key")
        value[key] = child
    return value


def safe_name(name):
    if not isinstance(name, str) or not name or name.startswith("/") or "\\" in name or ":" in name:
        raise ValueError("Invalid root-layout archive path")
    if any(ord(c) < 32 or ord(c) == 127 for c in name) or any(p in ("", ".", "..") for p in name.split("/")):
        raise ValueError("Unsafe archive path")
    return pathlib.PurePosixPath(name)


def public_firebase(value):
    def reject_private(node):
        if isinstance(node, dict):
            if node.get("type") == "service_account" or any(str(k).lower() in {"private_key", "private_key_id", "client_secret"} for k in node):
                raise ValueError("Firebase input contains nonpublic credential structure")
            for child in node.values():
                reject_private(child)
        elif isinstance(node, list):
            for child in node:
                reject_private(child)
    reject_private(value)
    if not isinstance(value, dict) or not isinstance(value.get("project_info"), dict) or not isinstance(value.get("client"), list):
        raise ValueError("Invalid public Firebase client configuration")
    project = value["project_info"]
    if not isinstance(project.get("project_number"), str) or not re.fullmatch(r"[0-9]+", project["project_number"]) or not isinstance(project.get("project_id"), str) or not project["project_id"].strip():
        raise ValueError("Invalid public Firebase project metadata")
    matches = []
    for client in value["client"]:
        if not isinstance(client, dict):
            raise ValueError("Invalid Firebase client entry")
        info = client.get("client_info")
        android = info.get("android_client_info") if isinstance(info, dict) else None
        if isinstance(android, dict) and android.get("package_name") == PACKAGE:
            matches.append(client)
    if len(matches) != 1:
        raise ValueError("Exactly one Firebase Android client must match the app package")
    client = matches[0]
    app_id = client["client_info"].get("mobilesdk_app_id")
    keys = client.get("api_key")
    if not isinstance(app_id, str) or not app_id.strip() or not isinstance(keys, list) or not keys or any(not isinstance(k, dict) or not isinstance(k.get("current_key"), str) or not k["current_key"].strip() for k in keys):
        raise ValueError("Matching Firebase client lacks public client configuration")


def verify(archive, source_commit, archive_sha256, manifest_sha256, checksums_sha256, allow_paths=()):
    for value, length, label in ((source_commit, 40, "source commit"), (archive_sha256, 64, "archive SHA256"), (manifest_sha256, 64, "manifest SHA256"), (checksums_sha256, 64, "checksum-file SHA256")):
        if not isinstance(value, str) or not re.fullmatch("[0-9a-f]{" + str(length) + "}", value) or set(value) == {"0"}:
            raise ValueError("An independently reviewed lowercase " + label + " is required")
    archive = pathlib.Path(archive)
    if archive.is_symlink() or not archive.is_file() or archive.stat().st_size > 100 * 1024 * 1024:
        raise ValueError("Archive must be a bounded regular local file")
    if sha(archive.read_bytes()) != archive_sha256:
        raise ValueError("Archive SHA256 differs from the independent pin")
    extras = set(allow_paths)
    for name in extras:
        safe_name(name)
    data = {}
    folded = set()
    total = 0
    with tarfile.open(archive, "r:gz") as tf:
        for count, member in enumerate(tf, 1):
            name = member.name
            safe_name(name)
            if count > 30000 or name in data or name.casefold() in folded:
                raise ValueError("Excessive or duplicate/case-colliding archive members")
            if not member.isreg() or member.issparse() or member.mode not in (0o644, 0o755):
                raise ValueError("Only ordinary source files with reviewed modes are permitted")
            if member.size < 0 or member.size > 256 * 1024 * 1024:
                raise ValueError("Archive member exceeds size guard")
            total += member.size
            if total > 1024 * 1024 * 1024:
                raise ValueError("Archive exceeds total uncompressed size guard")
            source = tf.extractfile(member)
            if source is None:
                raise ValueError("Archive member could not be read")
            with source:
                content = source.read()
            if len(content) != member.size:
                raise ValueError("Truncated archive member")
            data[name] = content
            folded.add(name.casefold())
    if MANIFEST not in data or CHECKSUMS not in data:
        raise ValueError("Archive lacks both manifest/checksum metadata files")
    if sha(data[MANIFEST]) != manifest_sha256 or sha(data[CHECKSUMS]) != checksums_sha256:
        raise ValueError("Archive metadata differs from independent pins")
    manifest = json.loads(data[MANIFEST], object_pairs_hook=unique_object)
    if not isinstance(manifest, dict) or manifest.get("sourceCommit") != source_commit or manifest.get("packageIdentity") != PACKAGE or manifest.get("requiredSignerSha256") != SIGNER:
        raise ValueError("Manifest source/package/signer differs from reviewed identity")
    files = manifest.get("files")
    if not isinstance(files, dict) or not files or {MANIFEST, CHECKSUMS}.intersection(files):
        raise ValueError("Manifest requires a nonempty source-only hash map")
    if set(data) != set(files) | {MANIFEST, CHECKSUMS} or not REQUIRED.issubset(files):
        raise ValueError("Missing/unlisted source or required Android/client input")
    if extras - set(files):
        raise ValueError("Explicit extra allowlist has unused entries; review exact source paths")
    actual = {}
    for name, expected in files.items():
        path = safe_name(name)
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
            raise ValueError("Invalid source SHA256 in manifest")
        if not (name in FIXED or name in extras or name.startswith(PREFIXES)) or name.startswith("android/app/src/main/assets/"):
            raise ValueError("Source is outside the reviewed packaging allowlist: " + name)
        if any(part.lower().startswith(".env") or part.lower() in DENIED_PARTS for part in path.parts) or path.name.lower() in {"local.properties", ".npmrc"} or path.suffix.lower() in DENIED_SUFFIXES:
            raise ValueError("Private/generated/non-input path refused: " + name)
        content = data[name]
        if b"PRIVATE KEY-----" in content or re.search(rb"(?:sk_live_|sk_test_|whsec_|sk-proj-|github_pat_|ghp_)[A-Za-z0-9_-]{16,}", content) or content.startswith(b"version https://git-lfs.github.com/spec/"):
            raise ValueError("Credential marker or unhydrated LFS input refused: " + name)
        actual[name] = sha(content)
        if actual[name] != expected:
            raise ValueError("Source content differs from its manifest hash: " + name)
    actual[MANIFEST] = manifest_sha256
    checksums = {}
    for line in data[CHECKSUMS].decode("utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if not match or match[2] in checksums:
            raise ValueError("Malformed or duplicate checksum entry")
        safe_name(match[2])
        checksums[match[2]] = match[1]
    if checksums != actual:
        raise ValueError("Checksum file must exactly cover source plus manifest; exclude itself")
    public_firebase(json.loads(data["android/app/google-services.json"], object_pairs_hook=unique_object))
    return {
        "status": "Read-only archive integrity preflight passed",
        "sourceCommit": source_commit, "archiveSha256": archive_sha256,
        "manifestSha256": manifest_sha256, "checksumsSha256": checksums_sha256,
        "sourceFileCount": len(files), "archiveMemberCount": len(data),
        "package": PACKAGE, "requiredSignerSha256": SIGNER,
        "explicitAdditionalPaths": sorted(extras),
        "limits": "No claim of source review, complete privacy review, source commit authenticity, dependency completeness, compilation, APK signature, backend pairing, device upgrade/runtime, distribution or production correctness.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=pathlib.Path)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--archive-sha256", required=True)
    parser.add_argument("--manifest-sha256", required=True)
    parser.add_argument("--checksums-sha256", required=True)
    parser.add_argument("--allow-path", action="append", default=[])
    args = parser.parse_args()
    try:
        report = verify(args.archive, args.source_commit, args.archive_sha256, args.manifest_sha256, args.checksums_sha256, args.allow_path)
    except (ValueError, OSError, tarfile.TarError) as error:
        parser.exit(1, "Archive verification refused: " + str(error) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
