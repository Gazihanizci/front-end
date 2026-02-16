import { CommonActions, createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

type AnyState = {
  routes?: Array<{ name?: string; state?: AnyState }>;
  index?: number;
};

const hasRoute = (state: AnyState | undefined, name: string): boolean => {
  if (!state?.routes) return false;
  for (const r of state.routes) {
    if (r?.name === name) return true;
    if (r?.state && hasRoute(r.state, name)) return true;
  }
  return false;
};

export function resetToLogin() {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState() as AnyState | undefined;
  if (!hasRoute(state, "Login")) return;
  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Login" }],
    })
  );
}
