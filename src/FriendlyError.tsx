export function errorSummary(message: string) {
  const clean = message.replace(/\x1b\[[0-9;]*m/g, "");
  if (/ENOSPC|no space left on device/i.test(clean))
    return "This device is out of disk space. Free up space, then try again.";
  if (/intercepts pointer events/.test(clean))
    return "Something on the website is covering that control. Review the browser, close any popup, and try again.";
  if (
    /locator\..*Timeout|waiting for locator|element.*(detached|not attached)/is.test(
      clean,
    )
  )
    return "The website changed or a control wasn’t ready. Review the browser and try again.";
  if (/page\.goto:.*Timeout/is.test(clean))
    return "The website took too long to load. Check your connection and try again.";
  if (clean.length > 500 || /Call log:|\n\s+at /.test(clean))
    return clean.split("\n")[0].slice(0, 250);
  return clean;
}
export function FriendlyError({ message }: { message: string }) {
  const summary = errorSummary(message);
  const clean = message.replace(/\x1b\[[0-9;]*m/g, "");
  return (
    <div className="friendly-error">
      <p>{summary}</p>
      {summary !== clean && (
        <details>
          <summary>Technical details</summary>
          <pre>{clean}</pre>
        </details>
      )}
    </div>
  );
}
