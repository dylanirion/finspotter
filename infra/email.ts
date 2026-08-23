import { secret } from "./secret"

export const email = new sst.aws.Email("Email", {
  sender: secret.SESSender.value,
  //sender: "example.com",
  //dmarc: "v=DMARC1; p=quarantine; adkim=s; aspf=s;"
  /*
  mailFrom: {
    domain: "mail.example.com"
  }
  */
})
