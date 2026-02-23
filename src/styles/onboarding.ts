// src/styles/onboarding.ts
// Shared onboarding styles built on theme tokens
import { StyleSheet, Platform } from 'react-native';
import { T } from '../theme';

// ── Re-export T so screens only need one import ──────────────────────────
export { T };

// ── Shared styles used across all onboarding screens ─────────────────────
export const S = StyleSheet.create({
  // Layout
  container: { flex: 1, backgroundColor: T.bg },
  scrollView: { flex: 1, padding: 20 },
  page: { flex: 1, backgroundColor: T.bg, padding: 20 },

  // Progress indicator
  progress: { fontSize: 14, color: T.textMuted, marginBottom: 20 },

  // Typography
  title: { fontSize: 32, fontWeight: 'bold', color: T.gold, marginBottom: 10 },
  titleGreen: { fontSize: 32, fontWeight: 'bold', color: T.green, marginBottom: 10 },
  titleRed: { fontSize: 32, fontWeight: 'bold', color: T.red, marginBottom: 10 },
  subtitle: { fontSize: 16, color: T.textSecondary, marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: T.textPrimary },
  label: { fontSize: 16, fontWeight: 'bold', color: T.textPrimary, marginBottom: 8, marginTop: 12 },
  helperText: { fontSize: 13, color: T.textMuted, marginBottom: 8 },

  // Info box
  infoBox: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 20, borderLeftWidth: 4, borderLeftColor: T.gold,
  },
  infoBoxGreen: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 20, borderLeftWidth: 4, borderLeftColor: T.green,
  },
  infoBoxRed: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 20, borderLeftWidth: 4, borderLeftColor: T.red,
  },
  infoText: { fontSize: 14, color: T.textSecondary, lineHeight: 20 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 15,
  },

  // Cards
  card: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 12, borderWidth: 1.5, borderColor: T.border,
  },
  cardGold: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 12, borderLeftWidth: 4, borderLeftColor: T.gold,
  },
  cardGreen: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 12, borderLeftWidth: 4, borderLeftColor: T.green,
  },
  cardRed: {
    backgroundColor: T.bgCard, padding: 16, borderRadius: T.radius.md,
    marginBottom: 12, borderLeftWidth: 4, borderLeftColor: T.red,
  },

  // Total summary box
  totalBox: {
    backgroundColor: T.bgCard, padding: 20, borderRadius: T.radius.md,
    marginBottom: 20, borderWidth: 2, borderColor: T.gold,
  },
  totalBoxGreen: {
    backgroundColor: T.bgCard, padding: 20, borderRadius: T.radius.md,
    marginBottom: 20, borderWidth: 2, borderColor: T.green,
  },
  totalBoxRed: {
    backgroundColor: T.bgCard, padding: 20, borderRadius: T.radius.md,
    marginBottom: 20, borderWidth: 2, borderColor: T.red,
  },
  totalLabel: { fontSize: 14, color: T.textSecondary, marginBottom: 4 },
  totalAmount: { fontSize: 28, fontWeight: 'bold', color: T.gold },
  totalAmountGreen: { fontSize: 28, fontWeight: 'bold', color: T.green },
  totalAmountRed: { fontSize: 28, fontWeight: 'bold', color: T.red },
  totalYearly: { fontSize: 14, color: T.textSecondary, marginTop: 4 },
  totalMonthly: { fontSize: 14, color: T.textSecondary, marginTop: 4 },

  // Empty state
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: T.textMuted, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: T.textDim, textAlign: 'center' },

  // Add button
  addButton: {
    backgroundColor: T.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm,
  },
  addButtonGreen: {
    backgroundColor: T.green, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm,
  },
  addButtonRed: {
    backgroundColor: T.red, paddingHorizontal: 16, paddingVertical: 8, borderRadius: T.radius.sm,
  },
  addButtonText: { color: T.bg, fontWeight: 'bold', fontSize: 14 },

  // Delete button
  deleteButton: { fontSize: 20, color: T.red, padding: 4 },

  // Input fields
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgCard,
    borderRadius: T.radius.md, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: T.border,
  },
  currencySymbol: { fontSize: 20, color: T.gold, marginRight: 8 },
  currencySymbolGreen: { fontSize: 20, color: T.green, marginRight: 8 },
  input: { flex: 1, fontSize: 20, color: T.textPrimary, paddingVertical: 16 },
  period: { fontSize: 14, color: T.textMuted, marginLeft: 8 },
  percent: { fontSize: 16, color: T.textMuted, marginLeft: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: T.gold, marginBottom: 20 },
  modalTitleGreen: { fontSize: 24, fontWeight: 'bold', color: T.green, marginBottom: 20 },
  modalTitleRed: { fontSize: 24, fontWeight: 'bold', color: T.red, marginBottom: 20 },
  modalInput: {
    backgroundColor: T.bgCard, borderRadius: T.radius.md, padding: 16,
    fontSize: 16, color: T.textPrimary, borderWidth: 1.5, borderColor: T.border,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  modalCancelButton: {
    flex: 1, padding: 16, borderRadius: T.radius.md,
    borderWidth: 1.5, borderColor: T.border, alignItems: 'center',
  },
  modalCancelText: { color: T.textSecondary, fontSize: 16 },
  modalAddButton: {
    flex: 1, padding: 16, borderRadius: T.radius.md,
    backgroundColor: T.gold, alignItems: 'center',
  },
  modalAddButtonGreen: {
    flex: 1, padding: 16, borderRadius: T.radius.md,
    backgroundColor: T.green, alignItems: 'center',
  },
  modalAddButtonRed: {
    flex: 1, padding: 16, borderRadius: T.radius.md,
    backgroundColor: T.red, alignItems: 'center',
  },
  modalAddButtonDisabled: { opacity: 0.5 },
  modalAddText: { color: T.bg, fontSize: 16, fontWeight: 'bold' },
  modalAddTextLight: { color: T.textPrimary, fontSize: 16, fontWeight: 'bold' },

  // Type/frequency selector buttons
  typeButtons: { flexDirection: 'row', gap: 8 },
  typeButton: {
    flex: 1, padding: 12, borderRadius: T.radius.sm,
    borderWidth: 1.5, borderColor: T.border, alignItems: 'center',
  },
  typeButtonActive: { borderColor: T.gold, backgroundColor: T.bgCardAlt },
  typeButtonActiveGreen: { borderColor: T.green, backgroundColor: T.bgCardAlt },
  typeButtonText: { fontSize: 13, color: T.textMuted },
  typeButtonTextActive: { color: T.gold, fontWeight: 'bold' },
  typeButtonTextActiveGreen: { color: T.green, fontWeight: 'bold' },

  // Account picker
  noAccountsText: {
    fontSize: 14, color: T.red, padding: 12,
    backgroundColor: T.bgCardAlt, borderRadius: T.radius.sm, marginTop: 4,
  },
  accountsList: { gap: 8, marginTop: 4 },
  accountOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderRadius: T.radius.sm, borderWidth: 1.5,
    borderColor: T.border, backgroundColor: T.bgCard,
  },
  accountOptionSelected: { borderColor: T.gold, backgroundColor: T.bgCardAlt },
  accountOptionSelectedGreen: { borderColor: T.green, backgroundColor: T.bgCardAlt },
  accountOptionContent: { flex: 1 },
  accountOptionText: { fontSize: 15, color: T.textPrimary, marginBottom: 2 },
  accountOptionTextSelected: { color: T.gold, fontWeight: 'bold' },
  accountOptionTextSelectedGreen: { color: T.green, fontWeight: 'bold' },
  accountOptionSub: { fontSize: 12, color: T.textMuted },
  accountOptionBadge: { fontSize: 12, color: T.green },
  accountOptionCheck: { fontSize: 18, color: T.gold, fontWeight: 'bold' },

  // Checkbox
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
    borderColor: T.border, marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: T.green, borderColor: T.green },
  checkmark: { color: T.bg, fontSize: 16, fontWeight: 'bold' },
  checkboxLabel: { fontSize: 14, color: T.textSecondary },

  // Bottom button area
  buttonContainer: {
    padding: 20, backgroundColor: T.bg, borderTopWidth: 1,
    borderTopColor: T.borderSubtle, flexDirection: 'row', gap: 12,
  },
  buttonContainerSingle: {
    padding: 20, backgroundColor: T.bg, borderTopWidth: 1,
    borderTopColor: T.borderSubtle,
  },
  button: {
    flex: 1, backgroundColor: T.gold, padding: 18,
    borderRadius: T.radius.md, alignItems: 'center',
  },
  buttonGreen: {
    flex: 1, backgroundColor: T.green, padding: 18,
    borderRadius: T.radius.md, alignItems: 'center',
  },
  buttonSecondary: { flex: 2, opacity: 0.5 },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: T.bg },
  skipButton: {
    flex: 1, padding: 18, borderRadius: T.radius.md,
    borderWidth: 1.5, borderColor: T.border, alignItems: 'center',
  },
  skipButtonText: { fontSize: 16, color: T.textSecondary },
});
