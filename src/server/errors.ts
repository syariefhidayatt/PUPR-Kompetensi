/** Error aplikasi dengan pesan aman untuk client. Jangan pernah memasukkan detail DB ke `message`. */
export class AppError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID",
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
