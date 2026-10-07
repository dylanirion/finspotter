import { Body, Button, Container, Section, Tailwind, Text } from "jsx-email"

export const templateName = "Verify Submission"

export const Template = (props: {
  title: string
  url: string
  role?: "submitter" | "subscriber"
}) => {
  const { title = "Title", url = "url", role = "submitter" } = props

  return (
    <Tailwind production={true}>
      <Body>
        <Container className="rounded-md bg-gray-200 p-4 font-sans">
          <Section className="text-center">
            <Text className="text-lg font-medium">
              {role === "submitter"
                ? "Someone has used your email address to submit an encounter to "
                : "Someone has invited you to receive encounter updates from "}
              <strong>{title}</strong>.
            </Text>
            <Text className="text-lg font-medium">
              {role === "submitter"
                ? "Confirm your submission and email address."
                : "Confirm your email address to receive updates."}
            </Text>
          </Section>
          <Section className="text-center">
            <Button
              href={url}
              width={60}
              height={20}
              className="rounded-md bg-indigo-600 px-4 py-2 text-base font-medium text-white"
              //borderRadius={6}
              align="center"
            >
              {role === "submitter"
                ? "Confirm submission"
                : "Confirm subscription"}
            </Button>
          </Section>
          <Section className="text-center text-base font-medium">
            <Text>
              If you did not request this email you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Tailwind>
  )
}
