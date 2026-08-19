import { redirect } from "next/navigation";

/** AI Designer is the product — no intro / extra hop. */
export default function AIDesignRedirect() {
  redirect("/ai");
}
