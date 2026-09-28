import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play, ShieldCheck, Workflow } from "lucide-react";
import { Connections, type Providers } from "./Connections";

export const setupPreference = "jeeves-setup:v1";
export function Onboarding({
  providers,
  onProviders,
  onFinish,
  onExample,
}: {
  providers: Providers;
  onProviders: (providers: Providers) => void;
  onFinish: () => void;
  onExample: () => void;
}) {
  const [step, setStep] = useState<"welcome" | "connections">("welcome");
  const pageRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);
  return (
    <main
      ref={pageRef}
      className="onboarding-page"
      aria-label="Welcome to Jeeves"
    >
      <header className="onboarding-top">
        <span className="onboarding-brand">jeeves</span>
        <button className="subtle-button" onClick={onFinish}>
          Skip setup for now
        </button>
      </header>
      {step === "welcome" ? (
        <section className="onboarding-welcome">
          <span className="eyebrow">A LITTLE DIRECTION. A LOT DONE.</span>
          <h1 ref={headingRef} tabIndex={-1}>
            Jev needs Jeeves.
            <br />
            <em>So does your to-do list.</em>
          </h1>
          <p>
            Jeeves turns repeat work into a workflow. Give each AI step a job,
            let Jev choose a route, and step in when your input is needed.
          </p>
          <div className="onboarding-steps">
            <article>
              <span>01</span>
              <h2>Describe the work</h2>
              <p>Start with notes, a request, or a saved workflow.</p>
            </article>
            <article>
              <span>02</span>
              <h2>See the steps</h2>
              <p>
                Agents do the work. Jev makes decisions. You can inspect both.
              </p>
            </article>
            <article>
              <span>03</span>
              <h2>Review the result</h2>
              <p>
                Answer questions along the way, then keep the process for next
                time.
              </p>
            </article>
          </div>
          <div className="onboarding-choices">
            <button
              className="primary-button"
              onClick={() => setStep("connections")}
            >
              <ArrowRight size={17} /> Set up my AI connections
            </button>
            <button className="secondary-button" onClick={onExample}>
              <Play size={16} /> Try the example
            </button>
          </div>
          <p className="onboarding-note">
            The sample needs no API keys. You can add connections later from
            Home or Settings.
          </p>
        </section>
      ) : (
        <section className="onboarding-connect">
          <button className="text-button" onClick={() => setStep("welcome")}>
            Back to welcome
          </button>
          <span className="eyebrow">YOUR TOOLS. YOUR WORKSPACE.</span>
          <h1 ref={headingRef} tabIndex={-1}>
            Connect the AI you want to use.
          </h1>
          <p className="onboarding-intro">
            For workflows with Jev decisions, connect Jev and one service for
            the agent steps. For writing tasks, one agent service is enough. You
            can skip any connection.
          </p>
          <div className="onboarding-providers">
            <section aria-label="Jev decision connection">
              <h2>
                <span className="jev-glyph">∵</span> Jev makes decisions
              </h2>
              <p>
                Use your TypeSafe API key for routing, readiness checks, and
                quality scores. Account access is managed by TypeSafe.
              </p>
              <Connections
                providers={providers}
                onChange={onProviders}
                allowed={["typesafe"]}
              />
              <p className="onboarding-hint">
                No Jev key yet? Try the sample or start with a writing workflow.
                You can connect Jev later.
              </p>
            </section>
            <section aria-label="Agent AI connection">
              <h2>
                <Workflow size={19} /> Agents do the work
              </h2>
              <p>
                Pick one service for writing and analysis. Codex uses its CLI
                login. The other hosted services use API keys.
              </p>
              <Connections
                providers={providers}
                onChange={onProviders}
                allowed={["openai", "codex", "openrouter", "local"]}
              />
            </section>
          </div>
          <div className="onboarding-footer">
            <p>
              <ShieldCheck size={17} /> Keys are saved in a private settings
              file on this computer, not in browser storage. Cloud services
              receive task context and may charge for use.
            </p>
            <button className="primary-button" onClick={onFinish}>
              Open my workspace <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
