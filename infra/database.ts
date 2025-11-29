import { secret } from "./secret"

const dbInstance = aws.rds.Instance.get(
  "DatabaseInstance",
  secret.RDSDbIdentifier.value
)

export const db = new sst.Linkable("Database", {
  properties: {
    host: dbInstance.address,
    database: secret.DbDatabase.value,
    user: secret.DbUser.value,
    password: secret.DbPassword.value,
    port: 3306,
  },
})

//TODO: manage database in pulumi?
//https://www.pulumi.com/registry/packages/mysql/api-docs/database/
