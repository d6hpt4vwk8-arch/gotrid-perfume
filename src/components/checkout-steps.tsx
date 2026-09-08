/**
 * Cart → checkout progress. Rendered on both pages so a visitor standing in
 * the cart can see how much is still ahead of them (Clarity showed ~70% of
 * carts never reaching /pokladna at all).
 */
export function CheckoutSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-medium">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
              step.done ? "bg-ink text-white" : "border border-line text-accent-2"
            }`}
          >
            {step.done ? "✓" : i + 1}
          </span>
          <span className={step.done ? "text-ink" : "text-accent-2"}>{step.label}</span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line" aria-hidden />}
        </div>
      ))}
    </div>
  );
}
