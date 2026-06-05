type ClipboardWriter = {
  writeText(text: string): Promise<void>;
};

export async function copyReportMarkdown(
  markdown: string,
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard,
) {
  if (!clipboard) {
    throw new Error('复制失败，请稍后重试。');
  }

  await clipboard.writeText(markdown);
}
