type FeedbackProps = {
  error?: string;
  loading: boolean;
  onRetry: () => void;
};

export const Feedback = ({ error, loading, onRetry }: FeedbackProps) => {
  if (loading) {
    return <div className="py-10 text-center text-sm text-zinc-500">Loading current state…</div>;
  }

  if (!error) return null;

  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200">
      <p className="leading-5">{error}</p>
      <button className="mt-2 font-medium text-rose-300 underline" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  );
};
