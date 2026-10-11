import { api, ApiError } from './apiClient'

export async function getSessionInfo() {
  try {
    const userInfo = await api.get('manage/info', {
      redirectOnUnauthorized: false,
      showToast: false,
    })

    if (!userInfo) {
      throw new ApiError('The server returned an invalid session response.')
    }

    return userInfo
  } catch (caughtError) {
    if (caughtError instanceof ApiError && caughtError.status === 401) {
      return null
    }

    throw caughtError
  }
}
