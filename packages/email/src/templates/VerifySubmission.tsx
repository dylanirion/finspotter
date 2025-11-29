import { Body, Button, Container, Section, Tailwind, Text } from "jsx-email"

export const templateName = "Verify Submission"

export const Template = (props: { title: string; url: string }) => {
  const { title = "Title", url = "url" } = props

  return (
    <Tailwind production={true}>
      <Body>
        <Container className="rounded-md bg-gray-200 p-4 font-sans">
          <Section className="text-center">
            <Text className="text-lg font-medium">
              Someone has used your email address to submit an encounter to{" "}
              <strong>{title}</strong>.
            </Text>
            <Text className="text-lg font-medium">
              Click below to verify your email and manage your communication
              preferences.
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
              Verify
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
