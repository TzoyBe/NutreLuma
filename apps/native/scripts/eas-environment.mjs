export function resolveEasEnvironment(baseEnv, projectRoot, gitRoot, pathApi) {
  const relativeProjectRoot = pathApi.relative(gitRoot, projectRoot);

  if (pathApi.isAbsolute(relativeProjectRoot)) {
    return {
      ...baseEnv,
      EAS_NO_VCS: '1',
      EAS_PROJECT_ROOT: projectRoot,
    };
  }

  return { ...baseEnv };
}
