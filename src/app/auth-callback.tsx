import { Redirect } from "expo-router";

/**
 * Where Google sign-in returns to in the app: plantparlour://auth-callback.
 * The in-app browser sheet hands that address straight to signInWithGoogle
 * (lib/auth.ts), which trades its code for a session. Android can also open
 * the app at it as a link, though, and without this route that would land on
 * "page not found". Nothing to show here: the session, if any, is already
 * being set up, so go home.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
