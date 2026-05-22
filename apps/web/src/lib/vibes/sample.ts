export const sampleYaml = `workflow:
  id: github_create_repo
  name: GitHub Create Repo
  description: Example StudioX Vibe
  steps:
    - id: extract_repo_info
      function: aiExtractVariables
      input:
        text: "\${conversationContext}"
        variables_to_extract:
          - name: repo_name
            type: string
            required: true
            description: "The GitHub repository name to create."
        max_tokens: 500
        temperature: 0

    - id: confirm_create_repo
      function: promptUser
      input:
        prompt: |
          Confirm repo creation:
          Repository: \${steps.extract_repo_info.output.repo_name}
          Reply YES to create it.
        prompt_type: "text"

    - id: response
      function: sendResponse
      input:
        type: "text"
        message: "Done."
`;