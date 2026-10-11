# React + Vite

## Sign-out

The navigation sign-out action invalidates the authentication cookie and checks
`/api/manage/info` before redirecting to `/login?signedOut=true`. Only a `401`
from that session endpoint confirms sign-out; network and server errors do not.
The login page displays the signed-out confirmation only when the URL parameter
is `signedOut=true` and the session has been verified as unauthenticated. This
also applies when reloading the login page. The former logout page and route
have been removed.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
