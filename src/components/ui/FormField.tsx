import type { FC, ReactNode } from 'react';

interface FormFieldProps {
  label: ReactNode;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

/**
 * Shared input/select/textarea base class.
 * Import and apply to any form control that needs the standard look.
 */
export const inputClass =
  'w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Wraps a label + form control + optional error / hint into the standard
 * field layout used across all modals and forms.
 */
const FormField: FC<FormFieldProps> = ({ label, required, error, hint, children }) => (
  <div>
    <label className="block text-fluid-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-fluid-sm font-bold text-red-500">{error}</p>}
    {hint && !error && <p className="mt-1 text-fluid-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);

export default FormField;
