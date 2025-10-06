import { Transaction, LockingScript, UnlockingScript, OP, Spend } from '@bsv/sdk'
import type { TransactionInput, TransactionOutput } from '@bsv/sdk'
import type {
  ExecutionStep,
  ExecutionState,
  StackDiff,
  StackChange,
  IFStackChange,
  SpendParams
} from '../types/scriptExecution'

/**
 * ScriptExecutor wraps the BSV SDK's Spend class to provide
 * step-by-step execution with full state history for debugging
 */
export class ScriptExecutor {
  private spend: typeof Spend
  private history: ExecutionStep[] = []
  private currentStepIndex: number = -1
  private initialState: ExecutionState

  constructor(params: SpendParams) {
    // Convert hex scripts to Script objects
    const lockingScript = LockingScript.fromHex(params.lockingScript)
    const unlockingScript = UnlockingScript.fromHex(params.unlockingScript)

    // Convert input/output arrays to proper types
    const otherInputs = params.otherInputs.map(input => {
      const txInput = new TransactionInput({
        sourceTXID: input.sourceTXID,
        sourceOutputIndex: input.sourceOutputIndex,
        sequence: input.sequence
      })
      return txInput
    })

    const outputs = params.outputs.map(output => {
      const txOutput = new TransactionOutput({
        satoshis: output.satoshis,
        lockingScript: LockingScript.fromHex(output.lockingScript)
      })
      return txOutput
    })

    // Create Spend instance
    this.spend = new Spend({
      sourceTXID: params.sourceTXID,
      sourceOutputIndex: params.sourceOutputIndex,
      sourceSatoshis: params.sourceSatoshis,
      lockingScript: lockingScript,
      transactionVersion: params.transactionVersion,
      otherInputs: otherInputs,
      outputs: outputs,
      unlockingScript: unlockingScript,
      inputSequence: params.inputSequence,
      inputIndex: params.inputIndex,
      lockTime: params.lockTime,
      memoryLimit: params.memoryLimit
    })

    // Capture initial state
    this.initialState = this.captureState()
  }

  /**
   * Execute one step forward
   */
  stepForward(): ExecutionStep | null {
    // If we're in the middle of history, just move forward
    if (this.currentStepIndex < this.history.length - 1) {
      this.currentStepIndex++
      this.restoreStateFromHistory(this.currentStepIndex)
      return this.history[this.currentStepIndex]
    }

    // Otherwise, execute a new step
    try {
      const beforeState = this.captureState()

      // Execute one step
      const hasMore = this.spend.step()

      const afterState = this.captureState()

      // Get the opcode that was just executed
      const script = beforeState.context === 'UnlockingScript'
        ? this.spend.unlockingScript
        : this.spend.lockingScript

      const chunk = script.chunks[beforeState.programCounter]
      const opcode = chunk?.op ?? 0
      const data = Array.isArray(chunk?.data) ? chunk.data : undefined

      // Calculate stack diff
      const stackDiff = this.calculateStackDiff(beforeState, afterState)

      // Create execution step
      const step: ExecutionStep = {
        stepNumber: this.history.length,
        context: beforeState.context,
        programCounter: beforeState.programCounter,
        opcode: opcode,
        opcodeName: this.getOpcodeName(opcode),
        opcodeHex: `0x${opcode.toString(16).padStart(2, '0')}`,
        data: data,
        stack: this.deepCopyStack(afterState.stack),
        altStack: this.deepCopyStack(afterState.altStack),
        ifStack: [...afterState.ifStack],
        stackMem: afterState.stackMem,
        altStackMem: afterState.altStackMem,
        description: this.generateDescription(opcode, data, beforeState, afterState),
        stackDiff: stackDiff,
        success: true
      }

      this.history.push(step)
      this.currentStepIndex++

      return step

    } catch (error) {
      // Capture error state
      const errorState = this.captureState()
      const errorStep: ExecutionStep = {
        stepNumber: this.history.length,
        context: errorState.context,
        programCounter: errorState.programCounter,
        opcode: 0,
        opcodeName: 'ERROR',
        opcodeHex: '0x00',
        stack: this.deepCopyStack(errorState.stack),
        altStack: this.deepCopyStack(errorState.altStack),
        ifStack: [...errorState.ifStack],
        stackMem: errorState.stackMem,
        altStackMem: errorState.altStackMem,
        description: `Error: ${error instanceof Error ? error.message : String(error)}`,
        stackDiff: {
          mainStackChanges: [],
          altStackChanges: [],
          ifStackChanges: []
        },
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }

      this.history.push(errorStep)
      this.currentStepIndex++
      return errorStep
    }
  }

  /**
   * Step backward through history
   */
  stepBackward(): ExecutionStep | null {
    if (this.currentStepIndex <= 0) {
      return null
    }

    this.currentStepIndex--
    this.restoreStateFromHistory(this.currentStepIndex)
    return this.history[this.currentStepIndex]
  }

  /**
   * Run to completion or until error
   */
  runToEnd(): ExecutionStep[] {
    const steps: ExecutionStep[] = []
    let step = this.stepForward()

    while (step && step.success && this.currentStepIndex < 10000) { // Safety limit
      steps.push(step)
      step = this.stepForward()
    }

    // Add final step if it exists (error or completion)
    if (step) {
      steps.push(step)
    }

    return steps
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.spend.reset()
    this.history = []
    this.currentStepIndex = -1
  }

  /**
   * Get current step
   */
  getCurrentStep(): ExecutionStep | null {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.history.length) {
      return null
    }
    return this.history[this.currentStepIndex]
  }

  /**
   * Get all execution history
   */
  getHistory(): ExecutionStep[] {
    return this.history
  }

  /**
   * Get total number of steps executed
   */
  getTotalSteps(): number {
    return this.history.length
  }

  /**
   * Check if at the beginning
   */
  isAtStart(): boolean {
    return this.currentStepIndex <= 0
  }

  /**
   * Check if at the end
   */
  isAtEnd(): boolean {
    return this.currentStepIndex >= this.history.length - 1
  }

  /**
   * Capture current execution state
   */
  private captureState(): ExecutionState {
    return {
      context: this.spend.context,
      programCounter: this.spend.programCounter,
      stack: this.deepCopyStack(this.spend.stack),
      altStack: this.deepCopyStack(this.spend.altStack),
      ifStack: [...this.spend.ifStack],
      stackMem: this.spend.stackMem,
      altStackMem: this.spend.altStackMem
    }
  }

  /**
   * Restore state from history (for step backward)
   */
  private restoreStateFromHistory(stepIndex: number): void {
    if (stepIndex < 0) {
      // Restore to initial state
      this.spend.reset()
      return
    }

    const step = this.history[stepIndex]
    this.spend.context = step.context
    this.spend.programCounter = step.programCounter + 1 // +1 because step() will have incremented it
    this.spend.stack = this.deepCopyStack(step.stack)
    this.spend.altStack = this.deepCopyStack(step.altStack)
    this.spend.ifStack = [...step.ifStack]
    this.spend.stackMem = step.stackMem
    this.spend.altStackMem = step.altStackMem
  }

  /**
   * Deep copy a stack
   */
  private deepCopyStack(stack: number[][]): number[][] {
    return stack.map(item => [...item])
  }

  /**
   * Calculate what changed between two states
   */
  private calculateStackDiff(before: ExecutionState, after: ExecutionState): StackDiff {
    const mainStackChanges: StackChange[] = []
    const altStackChanges: StackChange[] = []
    const ifStackChanges: IFStackChange[] = []

    // Compare main stacks
    if (after.stack.length > before.stack.length) {
      // Items were pushed
      for (let i = before.stack.length; i < after.stack.length; i++) {
        mainStackChanges.push({
          type: 'push',
          index: after.stack.length - 1 - i,
          value: after.stack[i]
        })
      }
    } else if (after.stack.length < before.stack.length) {
      // Items were popped
      for (let i = after.stack.length; i < before.stack.length; i++) {
        mainStackChanges.push({
          type: 'pop',
          index: before.stack.length - 1 - i,
          oldValue: before.stack[i]
        })
      }
    }

    // Check for modifications at same positions
    const minLen = Math.min(before.stack.length, after.stack.length)
    for (let i = 0; i < minLen; i++) {
      if (!this.arraysEqual(before.stack[i], after.stack[i])) {
        mainStackChanges.push({
          type: 'modify',
          index: after.stack.length - 1 - i,
          value: after.stack[i],
          oldValue: before.stack[i]
        })
      }
    }

    // Similar for alt stack
    if (after.altStack.length > before.altStack.length) {
      altStackChanges.push({
        type: 'push',
        index: after.altStack.length - 1,
        value: after.altStack[after.altStack.length - 1]
      })
    } else if (after.altStack.length < before.altStack.length) {
      altStackChanges.push({
        type: 'pop',
        index: before.altStack.length - 1,
        oldValue: before.altStack[before.altStack.length - 1]
      })
    }

    // IF stack changes
    if (after.ifStack.length > before.ifStack.length) {
      ifStackChanges.push({
        type: 'push',
        value: after.ifStack[after.ifStack.length - 1]
      })
    } else if (after.ifStack.length < before.ifStack.length) {
      ifStackChanges.push({
        type: 'pop'
      })
    } else if (after.ifStack.length > 0 &&
               before.ifStack[before.ifStack.length - 1] !== after.ifStack[after.ifStack.length - 1]) {
      ifStackChanges.push({
        type: 'flip',
        value: after.ifStack[after.ifStack.length - 1]
      })
    }

    return {
      mainStackChanges,
      altStackChanges,
      ifStackChanges
    }
  }

  /**
   * Check if two arrays are equal
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  /**
   * Get opcode name from opcode number
   */
  private getOpcodeName(opcode: number): string {
    return OP[opcode] as string || `OP_UNKNOWN_${opcode}`
  }

  /**
   * Generate human-readable description of what happened
   */
  private generateDescription(
    opcode: number,
    data: number[] | undefined,
    before: ExecutionState,
    after: ExecutionState
  ): string {
    const opname = this.getOpcodeName(opcode)

    // Data push operations
    if (opcode >= 0 && opcode <= 96) {
      if (data && data.length > 0) {
        const hex = Buffer.from(data).toString('hex')
        const preview = hex.length > 20 ? `${hex.slice(0, 20)}...` : hex
        return `Push data: ${preview} (${data.length} bytes)`
      }
      return 'Push empty data'
    }

    // Common operations
    switch (opcode) {
      case OP.OP_DUP:
        return 'Duplicate top stack item'
      case OP.OP_DROP:
        return 'Remove top stack item'
      case OP.OP_HASH160:
        return 'Hash top stack item with RIPEMD160(SHA256(x))'
      case OP.OP_EQUAL:
        return after.stack.length > 0 && after.stack[after.stack.length - 1][0] === 1
          ? 'Compared top two items: EQUAL'
          : 'Compared top two items: NOT EQUAL'
      case OP.OP_EQUALVERIFY:
        return 'Verified top two items are equal'
      case OP.OP_CHECKSIG:
        return after.stack.length > 0 && after.stack[after.stack.length - 1][0] === 1
          ? 'Signature verification: VALID ✓'
          : 'Signature verification: INVALID ✗'
      case OP.OP_ADD:
        return 'Added top two stack items'
      case OP.OP_SUB:
        return 'Subtracted top stack item from second'
      case OP.OP_IF:
        return `Conditional branch: ${after.ifStack[after.ifStack.length - 1] ? 'TRUE (executing)' : 'FALSE (skipping)'}`
      case OP.OP_ELSE:
        return 'Else branch'
      case OP.OP_ENDIF:
        return 'End conditional'
      case OP.OP_RETURN:
        return 'Terminate script execution'
      case OP.OP_TOALTSTACK:
        return 'Moved top item to alt stack'
      case OP.OP_FROMALTSTACK:
        return 'Moved top alt stack item to main stack'
      default:
        return `Execute ${opname}`
    }
  }
}
