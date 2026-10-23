import { Card, Stack, Text, Textarea, Title } from "@mantine/core";
import { useState } from "react";
import { mount } from "@ui/mount";
import { Shell } from "@ui/Shell";

function App() {
  const [text, setText] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <Shell title="Text Counter">
      <Stack gap="lg" pt="md">
        <Title order={1}>Text Counter</Title>
        <Card>
          <Stack>
            <Textarea
              label="Text"
              placeholder="Paste text here"
              autosize
              minRows={8}
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
            />
            <Text size="sm" c="dimmed" aria-live="polite">
              {words} Words · {[...text].length} Characters
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Shell>
  );
}

mount(<App />);
