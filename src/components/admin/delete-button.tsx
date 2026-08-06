"use client";

export function DeleteButton({
  action,
  confirmMessage,
  label = "Smazat",
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        {label}
      </button>
    </form>
  );
}
