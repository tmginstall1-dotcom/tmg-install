import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useStaffList() {
  return useQuery({
    queryKey: [api.staff.list.path],
    queryFn: async () => {
      const res = await fetch(api.staff.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });
}
