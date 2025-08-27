export const usePermissionStatus = async (
  name: PermissionName,
): Promise<{ state: string; granted: boolean }> => {
  const permission = await navigator.permissions.query({ name: name })
  return { state: permission.state, granted: permission.state === "granted" }
}
