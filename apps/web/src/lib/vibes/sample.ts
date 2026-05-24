export const sampleYaml = `workflow:
  id: github_access_review
  name: GitHub Access Review
  description: Demo StudioX Vibe with extraction, confirmation, branching, MCP/API action, and response.
  steps:
    - id: extract_request
      function: aiExtractVariables
      input:
        text: "\${conversationContext}"
        variables_to_extract:
          - name: repo_name
            type: string
            required: true
            description: "The GitHub repository name."
          - name: username
            type: string
            required: true
            description: "The GitHub username requesting access."
          - name: access_level
            type: string
            required: false
            default: "read"
            description: "Requested access level."
        max_tokens: 600
        temperature: 0

    - id: confirm_access
      function: promptUser
      input:
        prompt: |
          Confirm access change:

          Repository: \${steps.extract_request.output.repo_name}
          User: \${steps.extract_request.output.username}
          Access: \${steps.extract_request.output.access_level}

          Reply YES to continue.
        prompt_type: "text"

    - id: check_confirmation
      function: handleConditional
      input:
        condition:
          type: if
          condition:
            left: "\${steps.confirm_access.output.response}"
            operator: contains
            right: "YES"
          then:
            next: call_add_collaborator
          else:
            next: cancelled_response

    - id: call_add_collaborator
      function: apiRequest
      input:
        method: "POST"
        endpoint: "https://api.github.com/repos/example/\${steps.extract_request.output.repo_name}/collaborators/\${steps.extract_request.output.username}"
        body:
          permission: "\${steps.extract_request.output.access_level}"

    - id: success_response
      function: sendResponse
      input:
        type: "text"
        message: "Access update completed."

    - id: cancelled_response
      function: sendResponse
      input:
        type: "text"
        message: "Access update cancelled."
`;