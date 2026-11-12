import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { buildSettingsUpdate } from '../../src/domain/settings/settings-update';

describe('Mise à jour des paramètres de l’institution', () => {
  test('un champ absent reste inchangé', () => {
    assert.deepEqual(buildSettingsUpdate({}), {});
    assert.deepEqual(buildSettingsUpdate({ acronym: 'UPL' }), { acronym: 'UPL' });
  });

  test('un champ facultatif envoyé à null ou vide est effacé', () => {
    assert.deepEqual(buildSettingsUpdate({ contactEmail: null, contactPhone: '', address: '   ' }), {
      contactEmail: null,
      contactPhone: null,
      address: null,
    });
  });

  test('un champ obligatoire vide ou null n’est jamais effacé', () => {
    assert.deepEqual(buildSettingsUpdate({ institutionName: '', facultyName: null, acronym: '  ' }), {});
  });

  test('les valeurs sont débarrassées de leurs espaces', () => {
    assert.deepEqual(buildSettingsUpdate({ institutionName: '  UPL  ', portalSubtitle: ' Portail ' }), {
      institutionName: 'UPL',
      portalSubtitle: 'Portail',
    });
  });
});
