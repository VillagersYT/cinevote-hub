import { useEffect } from "react";
import { Toaster, toast, useSonner } from "sonner";

export function ClickableToaster() {
  const { toasts } = useSonner();

  useEffect(() => {
    const dismissClickedToast = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const toastElement = event.target.closest<HTMLElement>("[data-sonner-toast]");

      if (!toastElement) {
        return;
      }

      const toastIndex = Number(toastElement.dataset.index);
      const clickedToast = Number.isInteger(toastIndex) ? toasts[toastIndex] : undefined;

      if (clickedToast) {
        toast.dismiss(clickedToast.id);
      } else {
        toast.dismiss();
      }
    };

    document.addEventListener("click", dismissClickedToast);

    return () => {
      document.removeEventListener("click", dismissClickedToast);
    };
  }, [toasts]);

  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        className: "cursor-pointer select-none",
        closeButtonAriaLabel: "Fermer la notification",
      }}
    />
  );
}
