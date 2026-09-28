import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/** Same Next.js rule sets as before, loaded as ESLint 9 flat config. */
const eslintConfig = [...nextVitals, ...nextTs];

export default eslintConfig;
