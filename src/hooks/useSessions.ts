
import { useQuery } from "@tanstack/react-query";
import { listTodos } from "../../dataconnect-generated";

export function useSessions() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: () => listTodos(),
  });
}
