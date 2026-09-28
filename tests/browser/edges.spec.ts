import { test, expect } from "@playwright/test";
import { githubTriage, starter } from "../../shared/templates";

test("connections stay visible after Home navigation, reload, and zooming out", async ({
  page,
  request,
}) => {
  for (const workflow of [githubTriage, starter])
    await request.put(`/api/workflows/${workflow.id}`, { data: workflow });
  await page.goto("/");
  await page
    .locator(".workflow-link")
    .filter({ hasText: "GitHub maintenance" })
    .click();
  const paths = page.locator(".react-flow__edge-path");
  async function checkConnections(count: number) {
    await expect(paths).toHaveCount(count);
    const rendered = await paths.evaluateAll((elements) =>
      elements.map((element) => {
        const path = element as SVGPathElement;
        const css = getComputedStyle(path);
        const rgb = css.stroke.match(/\d+/g)!.slice(0, 3).map(Number);
        const luminance = (channels: number[]) =>
          channels
            .map((channel) => {
              const value = channel / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            })
            .reduce(
              (sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i],
              0,
            );
        return {
          length: path.getTotalLength(),
          width: parseFloat(css.strokeWidth),
          effect: css.vectorEffect,
          contrast:
            (luminance([247, 248, 244]) + 0.05) / (luminance(rgb) + 0.05),
          arrow: path.getAttribute("marker-end"),
        };
      }),
    );
    for (const edge of rendered) {
      expect(edge.length).toBeGreaterThan(10);
      expect(edge.width).toBeGreaterThanOrEqual(2);
      expect(edge.effect).toBe("non-scaling-stroke");
      expect(edge.contrast).toBeGreaterThanOrEqual(3);
      expect(edge.arrow).toContain("url(");
    }
  }
  await checkConnections(githubTriage.edges.length);
  const zoomOut = page.getByRole("button", { name: /zoom out/i });
  for (let i = 0; i < 8 && (await zoomOut.isEnabled()); i++)
    await zoomOut.click();
  await expect(zoomOut).toBeDisabled();
  await checkConnections(githubTriage.edges.length);
  await page.screenshot({
    path: test.info().outputPath("edges-zoomed-out.png"),
  });
  await page.reload();
  await checkConnections(githubTriage.edges.length);
  await page
    .locator(".workflow-link")
    .filter({ hasText: "Research to brief" })
    .click();
  await checkConnections(starter.edges.length);
  const edge = page.locator(".react-flow__edge").first();
  await edge.focus();
  await page.keyboard.press("Enter");
  await expect(edge).toHaveClass(/selected/);
  await expect(edge.locator(".react-flow__edge-path")).toHaveCSS(
    "stroke",
    "rgb(185, 77, 34)",
  );
  await expect(edge.locator(".react-flow__edge-path")).toHaveCSS(
    "stroke-width",
    "3px",
  );
});
