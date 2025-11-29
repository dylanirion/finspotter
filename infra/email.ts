import { secret } from "./secret"

export const email = new sst.Linkable("Email", {
  properties: {
    from: secret.EmailFrom.value,
    noreply: secret.EmailNoReply.value,
    smtp: {
      host: secret.EmailHost.value,
      port: secret.EmailPort.value,
      auth: {
        user: secret.EmailUser.value,
        pass: secret.EmailPassword.value,
      },
    },
  },
})
