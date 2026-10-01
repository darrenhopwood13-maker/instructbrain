/** Fixed storage path for a project's cover photograph (organisation-scoped folder). */
export function projectCoverPath(organisationId: string, projectId: string): string {
  return `${organisationId}/projects/${projectId}/cover.jpg`;
}
