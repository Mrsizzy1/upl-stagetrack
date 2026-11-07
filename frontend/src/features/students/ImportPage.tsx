import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Card, ErrorAlert, Field, Input, PageHeader, TableWrap, tableClass, tdClass, thClass } from '../../components/ui';
import { api, downloadFile } from '../../lib/api';

interface ImportReport {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  created: number;
  errors: { line: number; column: string; message: string }[];
  preview: { line: number; matricule: string; name: string }[];
}

export function ImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => {
      const form = new FormData();
      form.append('file', file!);
      return api.upload<ImportReport>(`/students/import?dryRun=${dryRun}`, form);
    },
    onSuccess: (r) => {
      setReport(r);
      if (!r.dryRun && r.created > 0) void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const canImport = report?.dryRun && report.errors.length === 0 && report.validRows > 0;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Importer des étudiants"
        description="Fichier CSV (séparateur ; ou ,) ou Excel .xlsx. Une simulation contrôle chaque ligne ; l'import n'enregistre rien tant qu'une seule erreur subsiste."
        actions={
          <Button variant="secondary" onClick={() => void downloadFile('/students/import/template.csv', 'modele-import-etudiants.csv')}>
            Télécharger le modèle
          </Button>
        }
      />
      <Card className="mb-6">
        <div className="space-y-2 text-sm text-upl-blue-800">
          <p>
            Colonnes obligatoires : <code>matricule, nom, postnom, prenom, faculte, departement, promotion, date_inscription</code>.
          </p>
          <p>
            Colonnes facultatives : <code>email, telephone, debut_stage, fin_stage, service_accueil</code>. Les colonnes faculté, département et
            promotion contiennent les <strong>codes</strong> définis dans le <Link to="/referentiel" className="underline">référentiel</Link>.
            Dates : JJ/MM/AAAA ou AAAA-MM-JJ.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Fichier" className="min-w-64 flex-1">
            {(id) => (
              <Input
                id={id}
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setReport(null);
                  run.reset();
                }}
              />
            )}
          </Field>
          <Button variant="secondary" disabled={!file} loading={run.isPending && run.variables === true} onClick={() => run.mutate(true)}>
            1. Simuler
          </Button>
          <Button disabled={!canImport} loading={run.isPending && run.variables === false} onClick={() => run.mutate(false)}>
            2. Importer
          </Button>
        </div>
      </Card>

      <ErrorAlert error={run.error} />

      {report && !report.dryRun && (
        <Alert tone="success" title={`${report.created} étudiant(s) importé(s)`}>
          Chacun a reçu un QR Code. Les cartes peuvent être imprimées depuis leur fiche.
        </Alert>
      )}

      {report && report.dryRun && (
        <div className="space-y-6">
          {report.errors.length === 0 ? (
            <Alert tone="success" title={`${report.validRows} ligne(s) valide(s)`}>
              Aucune erreur : vous pouvez lancer l'import.
            </Alert>
          ) : (
            <Alert tone="danger" title={`${report.errors.length} erreur(s) à corriger dans le fichier`}>
              Corrigez le fichier puis relancez la simulation. {report.validRows} ligne(s) sont valides.
            </Alert>
          )}
          {report.errors.length > 0 && (
            <Card title="Erreurs">
              <TableWrap>
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>Ligne</th>
                      <th className={thClass}>Colonne</th>
                      <th className={thClass}>Problème</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-upl-blue-100">
                    {report.errors.map((e, i) => (
                      <tr key={i}>
                        <td className={tdClass}>{e.line}</td>
                        <td className={`${tdClass} font-mono text-xs`}>{e.column}</td>
                        <td className={tdClass}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}
          {report.preview.length > 0 && (
            <Card title={`Aperçu (${Math.min(report.preview.length, 20)} premières lignes valides)`}>
              <ul className="text-sm">
                {report.preview.map((p) => (
                  <li key={p.line}>
                    Ligne {p.line} : <span className="font-mono">{p.matricule}</span> — {p.name}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
