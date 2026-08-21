import { secret } from "./secret"

export const email = new sst.Linkable("Email", {
  properties: {
    from: 1,//secret.EmailFrom.value,
    noreply: 1,//secret.EmailNoReply.value,
    smtp: {
      host: 1,//secret.EmailHost.value,
      port: 1,//secret.EmailPort.value,
      auth: {
        user: 1,//secret.EmailUser.value,
        pass: 1,//secret.EmailPassword.value,
      },
    },
  },
})
