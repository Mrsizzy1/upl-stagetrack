import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, ErrorAlert, Field, Modal, Select, Textarea } from '../../components/ui';
import { api } from '../../lib/api';
import { ATTENDANCE_LABELS, formatDate, fullName, SESSION_LABELS } from '../../lib/format';
import type { AttendanceRow, AttendanceStatus } from '../../lib/types';

/** Correction exceptionnelle d'un pointage : administrateur, motif obligatoire, journalisée. */
export function CorrectionModal({ row, onClose }: { row: AttendanceRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.post(`/attendance/${row!.id}/corrections`, { newStatus: status, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['student-history'] });
      close();
    },
  });
  function close() {
    setStatus('');
    setReason('');
    mutation.reset();
    onClose();
  }
  return (
    <Modal
      open={row !== null}
      title="Corriger un pointage"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!status || reason.trim().length < 10}>
            Enregistrer la correction
          </Button>
        </>
      }
    >
      {row && (
        <>
          <Alert tone="warning">
            Correction exceptionnelle : le statut d'origine est conservé et l'action est inscrite au journal d'audit.
          </Alert>
          <p className="text-sm">
            <strong>{fullName(row.student)}</strong> ({row.student.matricule}) — {formatDate(row.date)}, session du{' '}
            {SESSION_LABELS[row.sessionType].toLowerCase()}. Statut actuel : <strong>{ATTENDANCE_LABELS[row.status]}</strong>.
          </p>
          <ErrorAlert error={mutation.error} />
          <Field label="Nouveau statut" required>
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} required>
                <option value="">Choisir…</option>
                {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[])
                  .filter((s) => s !== row.status)
                  .map((s) => (
                    <option key={s} value={s}>
                      {ATTENDANCE_LABELS[s]}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Motif" hint="10 caractères minimum" required>
            {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} />}
          </Field>
        </>
      )}
    </Modal>
  );
}
