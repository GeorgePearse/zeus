import { Resource } from "@zeus-ai/console-resource"
import { Database } from "@zeus-ai/console-core/drizzle/index.js"
import { UserTable } from "@zeus-ai/console-core/schema/user.sql.js"
import { AccountTable } from "@zeus-ai/console-core/schema/account.sql.js"
import { WorkspaceTable } from "@zeus-ai/console-core/schema/workspace.sql.js"
import { BillingTable, PaymentTable, UsageTable } from "@zeus-ai/console-core/schema/billing.sql.js"
import { KeyTable } from "@zeus-ai/console-core/schema/key.sql.js"

if (Resource.App.stage !== "frank") throw new Error("This script is only for frank")

for (const table of [AccountTable, BillingTable, KeyTable, PaymentTable, UsageTable, UserTable, WorkspaceTable]) {
  await Database.use((tx) => tx.delete(table))
}
