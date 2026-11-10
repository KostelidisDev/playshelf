import { Component, type ErrorInfo, type ReactNode } from "react";
import { Message } from "./Message.tsx";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Shows a short note instead of a blank page if rendering throws. Without
 * it, one bad row or a bug in one view would leave the visitor with nothing.
 * The error is logged, not shown: the visitor can't fix it, and a reload
 * often helps. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) return <Message text="Something went wrong. Reload the page to try again." />;
    return this.props.children;
  }
}
