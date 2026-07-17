export class ProviderError extends Error {
  code: string
  status?: number
  constructor(message: string, code: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function friendlyError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error
  if (error instanceof DOMException && error.name === 'AbortError') return new ProviderError('请求已取消。', 'aborted')
  if (error instanceof TypeError) return new ProviderError('无法连接 API。可能是网络故障、地址错误或浏览器跨域（CORS）限制。', 'network_or_cors')
  if (error instanceof Error) return new ProviderError(error.message, 'unknown')
  return new ProviderError('发生未知错误，请检查配置后重试。', 'unknown')
}
