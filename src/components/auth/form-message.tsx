type FormMessageProps = {
  error?: string;
  message?: string;
};

export function FormMessage({ error, message }: FormMessageProps) {
  if (!error && !message) {
    return null;
  }

  return (
    <div
      className={
        error
          ? "rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          : "rounded-lg border border-accent bg-accent px-3 py-2 text-sm text-accent-foreground"
      }
    >
      {error || message}
    </div>
  );
}
