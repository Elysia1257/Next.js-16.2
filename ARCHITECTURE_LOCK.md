# ARCHITECTURE LOCK

This system is permanently locked to:

**Asset-driven AI Tool Network (Cubex Model)**

## Forbidden Concepts (HARD RULE)

The following are NEVER allowed:

- workflow
- dag
- pipeline
- execution graph
- node runtime
- step ordering
- graph execution
- executeGraph
- runWorkflow
- task queue
- orchestration engine

## System Definition

This is NOT a workflow system.

This is an Asset-driven AI Tool Network where:
- Assets are auto-generated entities
- Nodes are independent AI tools (mini apps)
- Canvas is a visual connector only
- Execution happens inside nodes
- No graph execution exists

## Required System Behavior

```
File Drop → Auto Detection → Upload → Asset Creation → Auto Node Creation
```

- No manual node type selection
- No upload inside nodes 
- No workflow routing
- Each Node executes independently
- Canvas has zero execution responsibility
- API calls happen inside Node only

## Node Types

ImageNode, VideoNode, AssetNode

Each Node is a self-contained AI tool (Mini App), NOT a workflow step.
