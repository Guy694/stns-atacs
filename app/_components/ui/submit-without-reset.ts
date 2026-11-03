"use client";

// React 19 resets an uncontrolled <form action={fn}> after every submit — even when the server action
// returns an error — so the user loses everything they typed. Submitting through onSubmit +
// startTransition dispatches the same useActionState action without that automatic reset.
//
//   const [error, formAction, pending] = useActionState(saveAction, null);
//   <form onSubmit={submitWithoutReset(formAction)}>…</form>
import { startTransition, type FormEvent } from "react";

export function submitWithoutReset(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    // Passing the submitter keeps the pressed button's name/value in the payload.
    const formData = submitter ? new FormData(event.currentTarget, submitter) : new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
