
import { useQuery } from "@tanstack/react-query";
import { getTodo } from "../../dataconnect-generated";

export function useSession({ id }: { id: string }) {
  return useQuery({
    queryKey: ["todos", id],
    queryFn: () => getTodo({ id }),
  });
}
