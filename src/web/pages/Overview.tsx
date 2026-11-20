import type { ReactElement } from "react";

import { PageHeader } from "@/components/layout";

/** Root page (`/`). Empty until #139's other children build the delivery metrics it will
 *  summarise — this story only has to land the shell they'll live in. */
export function Overview(): ReactElement {
  return <PageHeader title="Overview" />;
}
