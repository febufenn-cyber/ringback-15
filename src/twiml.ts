export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function response(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

export function gatherSpeech(action: string, prompt: string): string {
  return response(
    `<Gather input="speech" action="${escapeXml(action)}" method="POST" ` +
      `speechTimeout="auto" timeout="6"><Say>${escapeXml(prompt)}</Say></Gather>` +
      `<Say>We could not hear a response. The business will contact you directly. Goodbye.</Say><Hangup/>`,
  );
}

export function startQualificationTwiML(
  businessName: string,
  action: string,
  retry = false,
): string {
  const prefix = retry ? "I did not catch that. " : "";
  return gatherSpeech(
    action,
    `${prefix}Hello. You called ${businessName} a moment ago. I am their automated callback assistant. What service do you need help with?`,
  );
}

export function locationTwiML(action: string, retry = false): string {
  return gatherSpeech(
    action,
    `${retry ? "I did not catch that. " : ""}What area or postcode is the service needed in?`,
  );
}

export function urgencyTwiML(action: string, retry = false): string {
  return gatherSpeech(
    action,
    `${retry ? "I did not catch that. " : ""}How urgent is this: today, within a few days, or flexible?`,
  );
}

export function completeTwiML(): string {
  return response(
    "<Say>Thank you. I have sent your request to the business. No price or appointment has been confirmed. They will contact you directly. Goodbye.</Say><Hangup/>",
  );
}
