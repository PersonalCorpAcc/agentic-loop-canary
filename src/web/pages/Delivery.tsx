import type { ReactElement } from "react";

import { PageHeader } from "@/components/layout";

/** `/delivery` page. Empty until #139's other children build the four delivery metrics —
 *  this story only has to land the shell (and the top bar's period selector) they'll use. */
export function Delivery(): ReactElement {
  return <PageHeader title="Delivery" />;
}
