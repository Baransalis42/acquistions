export const formatValidationErrors = (errors) => {
 if (!errors || !errors.issues) return 'Validation error';

 if(Array.isArray(errors.issues)) return errors.issues.map(issue => issue.message).join(', ');

 return JSON.stringify(errors);
}