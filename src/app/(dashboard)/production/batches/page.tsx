'use client';

import { AlertCircle, Plus, Settings2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/dashboard/page-header';
import { ProductionNav } from '@/components/production/production-nav';
import { Button } from '@/components/ui/button';
import { DataTable, EmptyState, FormDrawer, LoadingState, StatusBadge } from '@/components/ui-library';
import { useBatch, useBatches } from '@/hooks/production/useBatches';
import { useBatchAction } from '@/hooks/production/useBatchAction';
import { useProductionMeta } from '@/hooks/production/useProductionMeta';
import { useProductionRequest } from '@/hooks/production/useProductionRequest';

const today = new Date().toISOString().slice(0, 10);

const initialCreateState = {
  expectedOutput: '100',
  peopleOffCount: '0',
  plannedQuantity: '100',
  productionCategory: 'ICE_CREAM_MAKING',
  productionDate: today,
  productionLine: 'Main Line',
  recipeId: '',
  shift: 'DAY',
  warehouseId: '',
  workerCount: '0',
};

type MaterialDraft = {
  additionalQuantity: string;
  closingQuantity: string;
  id: string;
  itemId: string;
  note: string;
  quantityActual: string;
  quantityIssued: string;
  quantityRequired: number;
  unitCost: string;
};

type OutputDraft = {
  actualQuantity: string;
  id: string;
  notes: string;
  wastageQuantity: string;
};

type WorkerDraft = {
  attendanceStatus: string;
  employeeId: string;
  hoursWorked: string;
  outputQuantity: string;
  remarks: string;
  workerName: string;
};

function asRows(value: unknown) {
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

export default function ProductionBatchesPage() {
  const batchesQuery = useBatches();
  const metaQuery = useProductionMeta();
  const request = useProductionRequest();
  const queryClient = useQueryClient();
  const actions = useBatchAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [createState, setCreateState] = useState(initialCreateState);
  const [batchEdit, setBatchEdit] = useState({ labourCost: '0', overheadCost: '0', peopleOffCount: '0', workerCount: '0' });
  const [materialDrafts, setMaterialDrafts] = useState<MaterialDraft[]>([]);
  const [outputDrafts, setOutputDrafts] = useState<OutputDraft[]>([]);
  const [workerDrafts, setWorkerDrafts] = useState<WorkerDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const batchDetailQuery = useBatch(manageBatchId ?? '');
  const batchDetail = batchDetailQuery.data as Record<string, unknown> | undefined;
  const rows =
    batchesQuery.data && typeof batchesQuery.data === 'object' && Array.isArray((batchesQuery.data as { data?: unknown }).data)
      ? (batchesQuery.data as { data: Array<Record<string, unknown>> }).data
      : [];
  const itemById = new Map((metaQuery.data?.items ?? []).map((item) => [item.id, item]));

  useEffect(() => {
    if (!batchDetail) return;
    const itemByIdForEffect = new Map((metaQuery.data?.items ?? []).map((item) => [item.id, item]));

    setBatchEdit({
      labourCost: String(batchDetail.labourCost ?? 0),
      overheadCost: String(batchDetail.overheadCost ?? 0),
      peopleOffCount: String(batchDetail.peopleOffCount ?? 0),
      workerCount: String(batchDetail.workerCount ?? 0),
    });

    setMaterialDrafts(asRows(batchDetail.materials).map((row) => {
      const item = itemByIdForEffect.get(String(row.item_id ?? ''));
      return {
        additionalQuantity: '0',
        closingQuantity: String(row.quantity_remaining ?? Math.max(0, Number(row.quantity_issued ?? row.quantity_required ?? 0) - Number(row.quantity_actual ?? 0))),
        id: String(row.id),
        itemId: String(row.item_id ?? ''),
        note: String(row.notes ?? ''),
        quantityActual: String(row.quantity_actual ?? row.quantity_issued ?? row.quantity_required ?? 0),
        quantityIssued: String(row.quantity_issued ?? row.quantity_required ?? 0),
        quantityRequired: Number(row.quantity_required ?? 0),
        unitCost: String(row.unit_cost ?? item?.unitCost ?? 0),
      };
    }));

    setOutputDrafts(asRows(batchDetail.outputs).map((row) => ({
      actualQuantity: String(row.actual_quantity ?? 0),
      id: String(row.id),
      notes: String(row.notes ?? ''),
      wastageQuantity: String(row.wastage_quantity ?? 0),
    })));

    const workers = asRows(batchDetail.workers);
    setWorkerDrafts(
      workers.length > 0
        ? workers.map((row) => ({
            attendanceStatus: String(row.attendance_status ?? 'PRESENT'),
            employeeId: String(row.employee_id ?? ''),
            hoursWorked: String(row.hours_worked ?? 0),
            outputQuantity: String(row.output_quantity ?? 0),
            remarks: String(row.remarks ?? ''),
            workerName: String(row.worker_name ?? ''),
          }))
        : [{ attendanceStatus: 'PRESENT', employeeId: '', hoursWorked: '0', outputQuantity: '0', remarks: '', workerName: '' }],
    );
  }, [batchDetail, metaQuery.data?.items]);

  async function handleCreateBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createState.recipeId || !createState.warehouseId || Number(createState.plannedQuantity) <= 0) {
      setFormError('Recipe, warehouse, and planned quantity are required.');
      return;
    }

    try {
      await request('/api/production/batches', {
        body: JSON.stringify({
          expectedOutput: Number(createState.expectedOutput),
          peopleOffCount: Number(createState.peopleOffCount),
          plannedQuantity: Number(createState.plannedQuantity),
          productionCategory: createState.productionCategory,
          productionDate: createState.productionDate,
          productionLine: createState.productionLine,
          recipeId: createState.recipeId,
          shift: createState.shift,
          warehouseId: createState.warehouseId,
          workerCount: Number(createState.workerCount),
        }),
        method: 'POST',
      });
      setCreateState(initialCreateState);
      setFormError(null);
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['production-batches'] });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create production batch.');
    }
  }

  async function runAction(action: () => Promise<unknown>) {
    try {
      setFormError(null);
      await action();
      await batchDetailQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Production action failed.');
    }
  }

  async function saveBatchFields() {
    if (!manageBatchId) return;
    await runAction(() => actions.updateBatch.mutateAsync({
      id: manageBatchId,
      labourCost: Number(batchEdit.labourCost),
      overheadCost: Number(batchEdit.overheadCost),
      peopleOffCount: Number(batchEdit.peopleOffCount),
      workerCount: Number(batchEdit.workerCount),
    }));
  }

  async function saveWorkers() {
    if (!manageBatchId) return;
    await runAction(() => actions.assignWorkers.mutateAsync({
      id: manageBatchId,
      workers: workerDrafts.map((worker) => ({
        attendanceStatus: worker.attendanceStatus,
        employeeId: worker.employeeId || undefined,
        hoursWorked: Number(worker.hoursWorked),
        isOffShift: ['OFF', 'ABSENT'].includes(worker.attendanceStatus),
        outputQuantity: Number(worker.outputQuantity),
        remarks: worker.remarks || undefined,
        workerName: worker.workerName || undefined,
      })),
    }));
  }

  async function saveMaterialUsage() {
    if (!manageBatchId) return;
    await runAction(() => actions.recordMaterialUsage.mutateAsync({
      id: manageBatchId,
      materials: materialDrafts.map((material) => ({
        id: material.id,
        note: material.note || undefined,
        quantityActual: Number(material.quantityActual),
        quantityIssued: Number(material.quantityIssued),
        unitCost: Number(material.unitCost),
      })),
      closingStocks: materialDrafts.map((material) => {
        const warehouseId = String(batchDetail?.warehouseId ?? '');
        const openingQuantity = Number(metaQuery.data?.stockByItemWarehouse?.[`${material.itemId}:${warehouseId}`] ?? 0);
        return {
          additionalQuantity: Number(material.additionalQuantity),
          closingQuantity: Number(material.closingQuantity),
          itemId: material.itemId,
          notes: material.note || undefined,
          openingQuantity,
          remainingQuantity: Number(material.closingQuantity),
          unitCost: Number(material.unitCost),
          usedQuantity: Number(material.quantityActual),
          warehouseId,
        };
      }),
    }));
  }

  async function saveOutput() {
    if (!manageBatchId) return;
    await runAction(() => actions.recordOutput.mutateAsync({
      id: manageBatchId,
      outputs: outputDrafts.map((output) => ({
        actualQuantity: Number(output.actualQuantity),
        id: output.id,
        notes: output.notes || undefined,
        wastageQuantity: Number(output.wastageQuantity),
      })),
    }));
  }

  async function passQuality() {
    if (!manageBatchId) return;
    await runAction(() => actions.recordQualityResult.mutateAsync({
      id: manageBatchId,
      notes: 'Passed from production workspace.',
      passedQuantity: Number(batchDetail?.actualOutput ?? 0),
      status: 'PASSED',
    }));
  }

  async function closeBatch() {
    if (!manageBatchId) return;
    await runAction(() => actions.closeBatch.mutateAsync({
      actualMaterials: materialDrafts.map((material) => ({
        itemId: material.itemId,
        quantityActual: Number(material.quantityActual),
      })),
      id: manageBatchId,
      wastageReason: 'Closed from production workspace.',
    }));
  }

  if (batchesQuery.isLoading || metaQuery.isLoading) return <LoadingState />;
  if (batchesQuery.isError || !batchesQuery.data) {
    return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Batches unavailable" description={batchesQuery.error?.message ?? 'No batch data returned.'} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production Batches"
        description="Run production WIP: reserve materials, record actual usage, output, people on shift, off-shift count, and close finished stock."
        actions={
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Batch
          </Button>
        }
      />
      <ProductionNav />
      <DataTable
        columns={[
          { key: 'batchNumber', header: 'Batch #' },
          { key: 'productionDate', header: 'Date' },
          { key: 'shift', header: 'Shift' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={String((row as Record<string, unknown>).status ?? '')} />,
          },
          { key: 'expectedOutput', header: 'Expected Output' },
          { key: 'actualOutput', header: 'Actual Output' },
          { key: 'workerCount', header: 'People On Shift' },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <Button type="button" size="sm" variant="outline" onClick={() => setManageBatchId(String((row as Record<string, unknown>).id))}>
                <Settings2 className="mr-2 h-4 w-4" />
                Manage WIP
              </Button>
            ),
          },
        ]}
        data={rows}
        emptyState={<EmptyState icon={<Plus className="h-6 w-6" />} title="No production batches" description="Create a batch after planning production." />}
      />

      <FormDrawer title="New Production Batch" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form className="space-y-5" onSubmit={handleCreateBatch}>
          {formError ? <ErrorBox message={formError} /> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="Recipe" value={createState.recipeId} onChange={(value) => {
              const recipe = metaQuery.data?.recipes.find((row) => row.id === value);
              setCreateState((current) => ({
                ...current,
                expectedOutput: String(recipe?.expectedOutputQuantity ?? current.expectedOutput),
                plannedQuantity: String(recipe?.expectedOutputQuantity ?? current.plannedQuantity),
                recipeId: value,
              }));
            }}>
              <option value="">Select recipe</option>
              {(metaQuery.data?.recipes ?? []).map((recipe) => <option key={recipe.id} value={recipe.id}>{String(recipe.code ?? '')} - {recipe.name}</option>)}
            </SelectField>
            <SelectField label="Production Warehouse" value={createState.warehouseId} onChange={(value) => setCreateState((current) => ({ ...current, warehouseId: value }))}>
              <option value="">Select warehouse</option>
              {(metaQuery.data?.warehouses ?? []).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{String(warehouse.name)}</option>)}
            </SelectField>
            <InputField label="Production Date" type="date" value={createState.productionDate} onChange={(value) => setCreateState((current) => ({ ...current, productionDate: value }))} />
            <SelectField label="Shift" value={createState.shift} onChange={(value) => setCreateState((current) => ({ ...current, shift: value }))}>
              <option value="DAY">Day</option>
              <option value="NIGHT">Night</option>
            </SelectField>
            <SelectField label="Production Category" value={createState.productionCategory} onChange={(value) => setCreateState((current) => ({ ...current, productionCategory: value }))}>
              {(metaQuery.data?.productionCategories ?? []).map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </SelectField>
            <InputField label="Production Line" value={createState.productionLine} onChange={(value) => setCreateState((current) => ({ ...current, productionLine: value }))} />
            <InputField label="Planned Quantity" type="number" value={createState.plannedQuantity} onChange={(value) => setCreateState((current) => ({ ...current, plannedQuantity: value }))} />
            <InputField label="Expected Output" type="number" value={createState.expectedOutput} onChange={(value) => setCreateState((current) => ({ ...current, expectedOutput: value }))} />
            <InputField label="People On Shift" type="number" value={createState.workerCount} onChange={(value) => setCreateState((current) => ({ ...current, workerCount: value }))} />
            <InputField label="People Off" type="number" value={createState.peopleOffCount} onChange={(value) => setCreateState((current) => ({ ...current, peopleOffCount: value }))} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Batch</Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer title={`Manage WIP${batchDetail?.batchNumber ? `: ${String(batchDetail.batchNumber)}` : ''}`} open={Boolean(manageBatchId)} onClose={() => setManageBatchId(null)}>
        {batchDetailQuery.isLoading ? <LoadingState /> : (
          <div className="space-y-6">
            {formError ? <ErrorBox message={formError} /> : null}
            <div className="flex flex-wrap gap-2">
              <WorkflowButtons
                batchId={manageBatchId}
                status={String(batchDetail?.status ?? '')}
                qualityStatus={String(batchDetail?.qualityStatus ?? '')}
                actions={actions}
                closeBatch={closeBatch}
                passQuality={passQuality}
                runAction={runAction}
              />
            </div>

            <Section title="Shift People And Cost">
              <div className="grid gap-3 sm:grid-cols-4">
                <InputField label="People On Shift" type="number" value={batchEdit.workerCount} onChange={(value) => setBatchEdit((current) => ({ ...current, workerCount: value }))} />
                <InputField label="People Off" type="number" value={batchEdit.peopleOffCount} onChange={(value) => setBatchEdit((current) => ({ ...current, peopleOffCount: value }))} />
                <InputField label="Labour Cost" type="number" value={batchEdit.labourCost} onChange={(value) => setBatchEdit((current) => ({ ...current, labourCost: value }))} />
                <InputField label="Overhead Cost" type="number" value={batchEdit.overheadCost} onChange={(value) => setBatchEdit((current) => ({ ...current, overheadCost: value }))} />
              </div>
              <Button type="button" size="sm" onClick={saveBatchFields}>Save People/Costs</Button>
            </Section>

            <Section title="Worker Attendance">
              <div className="space-y-3">
                {workerDrafts.map((worker, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_110px_100px_100px_auto]">
                    <select className="surface-input-soft" value={worker.employeeId} onChange={(event) => setWorkerDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, employeeId: event.target.value } : row))}>
                      <option value="">Manual worker</option>
                      {(metaQuery.data?.employees ?? []).map((employee) => (
                        <option key={String(employee.id)} value={String(employee.id)}>{String(employee.displayName)}</option>
                      ))}
                    </select>
                    <input className="surface-input-soft" placeholder="Worker name" value={worker.workerName} onChange={(event) => setWorkerDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, workerName: event.target.value } : row))} />
                    <select className="surface-input-soft" value={worker.attendanceStatus} onChange={(event) => setWorkerDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, attendanceStatus: event.target.value } : row))}>
                      <option value="PRESENT">Present</option>
                      <option value="OFF">Off</option>
                      <option value="ABSENT">Absent</option>
                      <option value="LATE">Late</option>
                    </select>
                    <input className="surface-input-soft" type="number" placeholder="Hours" value={worker.hoursWorked} onChange={(event) => setWorkerDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, hoursWorked: event.target.value } : row))} />
                    <input className="surface-input-soft" type="number" placeholder="Output" value={worker.outputQuantity} onChange={(event) => setWorkerDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, outputQuantity: event.target.value } : row))} />
                    <Button type="button" variant="outline" onClick={() => setWorkerDrafts((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setWorkerDrafts((current) => [...current, { attendanceStatus: 'PRESENT', employeeId: '', hoursWorked: '0', outputQuantity: '0', remarks: '', workerName: '' }])}>Add Worker</Button>
                <Button type="button" size="sm" onClick={saveWorkers}>Save Workers</Button>
              </div>
            </Section>

            <Section title="Actual Raw Materials Used">
              {materialDrafts.length === 0 ? <p className="text-sm text-muted">Reserve materials first to create material usage lines.</p> : null}
              {materialDrafts.map((material, index) => {
                const item = itemById.get(material.itemId);
                const remaining = Math.max(0, Number(material.quantityIssued) - Number(material.quantityActual || 0));
                return (
                  <div key={material.id} className="grid gap-3 rounded-xl bg-white p-3 dark:bg-darkCard md:grid-cols-[1fr_105px_105px_105px_105px_105px_110px]">
                    <div>
                      <p className="font-medium text-brown dark:text-darkText">{String(item?.code ?? '')} {String(item?.name ?? material.itemId)}</p>
                      <p className="text-xs text-muted">Required {material.quantityRequired.toFixed(3)} · Remaining {remaining.toFixed(3)}</p>
                    </div>
                    <InputField label="Issued" type="number" value={material.quantityIssued} onChange={(value) => setMaterialDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantityIssued: value } : row))} />
                    <InputField label="Actual Used" type="number" value={material.quantityActual} onChange={(value) => setMaterialDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantityActual: value } : row))} />
                    <InputField label="Additional" type="number" value={material.additionalQuantity} onChange={(value) => setMaterialDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, additionalQuantity: value } : row))} />
                    <InputField label="Closing" type="number" value={material.closingQuantity} onChange={(value) => setMaterialDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, closingQuantity: value } : row))} />
                    <InputField label="Unit Cost" type="number" value={material.unitCost} onChange={(value) => setMaterialDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: value } : row))} />
                    <InputField label="Note" value={material.note} onChange={(value) => setMaterialDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, note: value } : row))} />
                  </div>
                );
              })}
              <Button type="button" size="sm" onClick={saveMaterialUsage} disabled={materialDrafts.length === 0}>Save Material Usage</Button>
            </Section>

            <Section title="Finished Output">
              {outputDrafts.length === 0 ? <p className="text-sm text-muted">No output line exists for this batch.</p> : null}
              {outputDrafts.map((output, index) => (
                <div key={output.id} className="grid gap-3 md:grid-cols-3">
                  <InputField label="Actual Finished Quantity" type="number" value={output.actualQuantity} onChange={(value) => setOutputDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, actualQuantity: value } : row))} />
                  <InputField label="Wastage Quantity" type="number" value={output.wastageQuantity} onChange={(value) => setOutputDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, wastageQuantity: value } : row))} />
                  <InputField label="Notes" value={output.notes} onChange={(value) => setOutputDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, notes: value } : row))} />
                </div>
              ))}
              <Button type="button" size="sm" onClick={saveOutput} disabled={outputDrafts.length === 0}>Save Output</Button>
            </Section>
          </div>
        )}
      </FormDrawer>
    </div>
  );
}

function WorkflowButtons({
  actions,
  batchId,
  closeBatch,
  passQuality,
  qualityStatus,
  runAction,
  status,
}: {
  actions: ReturnType<typeof useBatchAction>;
  batchId: string | null;
  closeBatch: () => Promise<void>;
  passQuality: () => Promise<void>;
  qualityStatus: string;
  runAction: (action: () => Promise<unknown>) => Promise<void>;
  status: string;
}) {
  if (!batchId) return null;
  return (
    <>
      {status === 'PLANNED' ? <Button type="button" size="sm" onClick={() => runAction(() => actions.requestMaterials.mutateAsync(batchId))}>Request Materials</Button> : null}
      {status === 'MATERIALS_REQUESTED' ? <Button type="button" size="sm" onClick={() => runAction(() => actions.approveMaterials.mutateAsync(batchId))}>Approve Materials</Button> : null}
      {status === 'MATERIALS_APPROVED' ? <Button type="button" size="sm" onClick={() => runAction(() => actions.reserveMaterials.mutateAsync(batchId))}>Reserve Materials</Button> : null}
      {status === 'MATERIALS_RESERVED' ? <Button type="button" size="sm" onClick={() => runAction(() => actions.startBatch.mutateAsync(batchId))}>Start Production</Button> : null}
      {['IN_PROGRESS', 'WIP'].includes(status) ? <Button type="button" size="sm" onClick={() => runAction(() => actions.submitQuality.mutateAsync(batchId))}>Submit QC</Button> : null}
      {status === 'QUALITY_CHECK' && qualityStatus === 'PENDING' ? <Button type="button" size="sm" onClick={passQuality}>Pass QC</Button> : null}
      {status === 'QUALITY_CHECK' && qualityStatus !== 'PENDING' ? <Button type="button" size="sm" onClick={closeBatch}>Close Batch</Button> : null}
    </>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-cream/60 p-4 dark:border-darkBorder dark:bg-darkBg/40">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange">{title}</p>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{message}</div>;
}

function InputField({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <input className="surface-input-soft" min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.001' : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-2 text-sm text-muted">
      <span>{label}</span>
      <select className="surface-input-soft" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
