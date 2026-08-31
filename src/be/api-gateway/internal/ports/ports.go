// Package ports defines the service interfaces (ports) used by the API gateway handlers.
// Each interface abstracts a downstream service so that handlers are decoupled from the
// transport layer (gRPC, message broker, etc.).
package ports

import (
	"context"

	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
	rawatjalanpb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
)

// AuthPort abstracts the auth-service operations.
type AuthPort interface {
	Login(ctx context.Context, req *authpb.LoginRequest) (*authpb.LoginResponse, error)
	RefreshToken(ctx context.Context, req *authpb.RefreshTokenRequest) (*authpb.RefreshTokenResponse, error)
	Signup(ctx context.Context, req *authpb.SignupRequest) (*authpb.SignupResponse, error)
	ExtractKTPData(ctx context.Context, req *authpb.ExtractKTPDataRequest) (*authpb.ExtractKTPDataResponse, error)
	ListLabelProfesi(ctx context.Context, req *authpb.ListLabelProfesiRequest) (*authpb.ListLabelProfesiResponse, error)
	ListUsers(ctx context.Context, req *authpb.ListUsersRequest) (*authpb.ListUsersResponse, error)
	UpdateUserStatus(ctx context.Context, req *authpb.UpdateUserStatusRequest) (*authpb.UpdateUserStatusResponse, error)
	DeleteUser(ctx context.Context, req *authpb.DeleteUserRequest) (*authpb.DeleteUserResponse, error)
	GetMasterRoles(ctx context.Context, req *authpb.GetMasterRolesRequest) (*authpb.GetMasterRolesResponse, error)
	GetDoctors(ctx context.Context, req *authpb.GetDoctorsRequest) (*authpb.GetDoctorsResponse, error)
	GetNurses(ctx context.Context, req *authpb.GetNursesRequest) (*authpb.GetNursesResponse, error)
	GetDoctorsByPoli(ctx context.Context, req *authpb.GetDoctorsByPoliRequest) (*authpb.GetDoctorsByPoliResponse, error)
	GetNursesByPoli(ctx context.Context, req *authpb.GetNursesByPoliRequest) (*authpb.GetNursesByPoliResponse, error)
	AssignDoctorPoli(ctx context.Context, req *authpb.AssignDoctorPoliRequest) (*authpb.AssignDoctorPoliResponse, error)
	AssignNursePoli(ctx context.Context, req *authpb.AssignNursePoliRequest) (*authpb.AssignNursePoliResponse, error)
	UnassignDoctorPoli(ctx context.Context, req *authpb.UnassignDoctorPoliRequest) (*authpb.UnassignDoctorPoliResponse, error)
	UnassignNursePoli(ctx context.Context, req *authpb.UnassignNursePoliRequest) (*authpb.UnassignNursePoliResponse, error)
	UpdatePoliSchedule(ctx context.Context, req *authpb.UpdatePoliScheduleRequest) (*authpb.UpdatePoliScheduleResponse, error)
	GetAssignedPoli(ctx context.Context, req *authpb.GetAssignedPoliRequest) (*authpb.GetAssignedPoliResponse, error)
	GetActivePersonnelMetrics(ctx context.Context, req *authpb.GetActivePersonnelMetricsRequest) (*authpb.GetActivePersonnelMetricsResponse, error)
	RegisterPatientUser(ctx context.Context, req *authpb.RegisterPatientUserRequest) (*authpb.RegisterPatientUserResponse, error)
}

// PatientPort abstracts the patient-service operations.
type PatientPort interface {
	RegisterPatient(ctx context.Context, req *patientpb.RegisterPatientRequest) (*patientpb.RegisterPatientResponse, error)
	GetPatientByMRN(ctx context.Context, req *patientpb.GetPatientByMRNRequest) (*patientpb.GetPatientByMRNResponse, error)
	SearchPatients(ctx context.Context, req *patientpb.SearchPatientsRequest) (*patientpb.SearchPatientsResponse, error)
	DeletePatient(ctx context.Context, req *patientpb.DeletePatientRequest) (*patientpb.DeletePatientResponse, error)
}

// RegistrationPort abstracts the registration-service operations.
type RegistrationPort interface {
	RegisterEncounter(ctx context.Context, req *regpb.RegisterEncounterRequest) (*regpb.RegisterEncounterResponse, error)
	CancelEncounter(ctx context.Context, req *regpb.CancelEncounterRequest) (*regpb.CancelEncounterResponse, error)
	UpdateEncounterGuarantor(ctx context.Context, req *regpb.UpdateEncounterGuarantorRequest) (*regpb.UpdateEncounterGuarantorResponse, error)
	UpdateEncounterStatus(ctx context.Context, req *regpb.UpdateEncounterStatusRequest) (*regpb.UpdateEncounterStatusResponse, error)
	GetDashboardMetrics(ctx context.Context, req *regpb.GetDashboardMetricsRequest) (*regpb.GetDashboardMetricsResponse, error)
	GetTodayEncounters(ctx context.Context, req *regpb.GetTodayEncountersRequest) (*regpb.GetTodayEncountersResponse, error)
}

// EMRPort abstracts the emr/medical-record-service operations.
type EMRPort interface {
	// Core EMR flow
	StartEncounter(ctx context.Context, req *emrpb.StartEncounterRequest) (*emrpb.StartEncounterResponse, error)
	CompleteEncounter(ctx context.Context, req *emrpb.CompleteEncounterRequest) (*emrpb.CompleteEncounterResponse, error)
	FinalizeMedicalRecord(ctx context.Context, req *emrpb.FinalizeMedicalRecordRequest) (*emrpb.FinalizeMedicalRecordResponse, error)
	GetMedicalRecord(ctx context.Context, req *emrpb.GetMedicalRecordRequest) (*emrpb.GetMedicalRecordResponse, error)
	FinalizeSeverity(ctx context.Context, req *emrpb.FinalizeSeverityRequest) (*emrpb.FinalizeSeverityResponse, error)
	// Diagnosis
	AddEncounterDiagnosis(ctx context.Context, req *emrpb.AddEncounterDiagnosisRequest) (*emrpb.AddEncounterDiagnosisResponse, error)
	UpdateEncounterDiagnosis(ctx context.Context, req *emrpb.UpdateEncounterDiagnosisRequest) (*emrpb.UpdateEncounterDiagnosisResponse, error)
	RemoveEncounterDiagnosis(ctx context.Context, req *emrpb.RemoveEncounterDiagnosisRequest) (*emrpb.RemoveEncounterDiagnosisResponse, error)
	// KBM / Coding
	SearchKBM(ctx context.Context, req *emrpb.SearchKBMRequest) (*emrpb.SearchKBMResponse, error)
	GetKBMDetail(ctx context.Context, req *emrpb.GetKBMDetailRequest) (*emrpb.GetKBMDetailResponse, error)
	GetICD10SuggestionsForKBM(ctx context.Context, req *emrpb.GetICD10SuggestionsForKBMRequest) (*emrpb.GetICD10SuggestionsForKBMResponse, error)
	GetKBMSuggestionsForICD10(ctx context.Context, req *emrpb.GetKBMSuggestionsForICD10Request) (*emrpb.GetKBMSuggestionsForICD10Response, error)
	ListPendingKBMVerifications(ctx context.Context, req *emrpb.ListPendingKBMVerificationsRequest) (*emrpb.ListPendingKBMVerificationsResponse, error)
	VerifyKBMMapping(ctx context.Context, req *emrpb.VerifyKBMMappingRequest) (*emrpb.VerifyKBMMappingResponse, error)
	// Master data
	GetPolyclinics(ctx context.Context, req *emrpb.GetPolyclinicsRequest) (*emrpb.GetPolyclinicsResponse, error)
	GetMasterKBMs(ctx context.Context, req *emrpb.GetMasterKBMsRequest) (*emrpb.GetMasterKBMsResponse, error)
	GetMasterKBMsByPoli(ctx context.Context, req *emrpb.GetMasterKBMsByPoliRequest) (*emrpb.GetMasterKBMsByPoliResponse, error)
	GetMasterTindakan(ctx context.Context, req *emrpb.GetMasterTindakanRequest) (*emrpb.GetMasterTindakanResponse, error)
	GetMasterTindakanByPoli(ctx context.Context, req *emrpb.GetMasterTindakanByPoliRequest) (*emrpb.GetMasterTindakanByPoliResponse, error)
	GetMasterICD10(ctx context.Context, req *emrpb.GetMasterICD10Request) (*emrpb.GetMasterICD10Response, error)
	GetMasterICD10ByPoli(ctx context.Context, req *emrpb.GetMasterICD10ByPoliRequest) (*emrpb.GetMasterICD10ByPoliResponse, error)
	GetICD10MappingDetails(ctx context.Context, req *emrpb.GetICD10MappingDetailsRequest) (*emrpb.GetICD10MappingDetailsResponse, error)
	GetMasterICD9(ctx context.Context, req *emrpb.GetMasterICD9Request) (*emrpb.GetMasterICD9Response, error)
	GetICD9MappingDetails(ctx context.Context, req *emrpb.GetICD9MappingDetailsRequest) (*emrpb.GetICD9MappingDetailsResponse, error)
	GetICD9SuggestionsForTindakan(ctx context.Context, req *emrpb.GetICD9SuggestionsForTindakanRequest) (*emrpb.GetICD9SuggestionsForTindakanResponse, error)
	GetMasterSNOMED(ctx context.Context, req *emrpb.GetMasterSNOMEDRequest) (*emrpb.GetMasterSNOMEDResponse, error)
	GetSNOMEDMappingDetails(ctx context.Context, req *emrpb.GetSNOMEDMappingDetailsRequest) (*emrpb.GetSNOMEDMappingDetailsResponse, error)
}

// RawatJalanPort abstracts the rawat-jalan-service operations.
type RawatJalanPort interface {
	SubmitTriage(ctx context.Context, req *rawatjalanpb.SubmitTriageRequest) (*rawatjalanpb.SubmitTriageResponse, error)
	StartEncounter(ctx context.Context, req *rawatjalanpb.StartEncounterRequest) (*rawatjalanpb.StartEncounterResponse, error)
	CompleteEncounter(ctx context.Context, req *rawatjalanpb.CompleteEncounterRequest) (*rawatjalanpb.CompleteEncounterResponse, error)
	FinalizeMedicalRecord(ctx context.Context, req *rawatjalanpb.FinalizeMedicalRecordRequest) (*rawatjalanpb.FinalizeMedicalRecordResponse, error)
	GetMedicalRecord(ctx context.Context, req *rawatjalanpb.GetMedicalRecordRequest) (*rawatjalanpb.GetMedicalRecordResponse, error)
	FinalizeSeverity(ctx context.Context, req *rawatjalanpb.FinalizeSeverityRequest) (*rawatjalanpb.FinalizeSeverityResponse, error)
	AddMedicalAction(ctx context.Context, req *rawatjalanpb.AddMedicalActionRequest) (*rawatjalanpb.AddMedicalActionResponse, error)
	RemoveMedicalAction(ctx context.Context, req *rawatjalanpb.RemoveMedicalActionRequest) (*rawatjalanpb.RemoveMedicalActionResponse, error)
	AddEncounterDiagnosis(ctx context.Context, req *rawatjalanpb.AddEncounterDiagnosisRequest) (*rawatjalanpb.AddEncounterDiagnosisResponse, error)
	UpdateEncounterDiagnosis(ctx context.Context, req *rawatjalanpb.UpdateEncounterDiagnosisRequest) (*rawatjalanpb.UpdateEncounterDiagnosisResponse, error)
	RemoveEncounterDiagnosis(ctx context.Context, req *rawatjalanpb.RemoveEncounterDiagnosisRequest) (*rawatjalanpb.RemoveEncounterDiagnosisResponse, error)
	PromoteDiagnosisToPrimary(ctx context.Context, req *rawatjalanpb.PromoteDiagnosisToPrimaryRequest) (*rawatjalanpb.PromoteDiagnosisToPrimaryResponse, error)
	GetKBMSuggestionsForICD10(ctx context.Context, req *rawatjalanpb.GetKBMSuggestionsForICD10Request) (*rawatjalanpb.GetKBMSuggestionsForICD10Response, error)
	SearchKBM(ctx context.Context, req *rawatjalanpb.SearchKBMRequest) (*rawatjalanpb.SearchKBMResponse, error)
	GetKBMDetail(ctx context.Context, req *rawatjalanpb.GetKBMDetailRequest) (*rawatjalanpb.GetKBMDetailResponse, error)
	GetMasterTindakanByPoli(ctx context.Context, req *rawatjalanpb.GetMasterTindakanByPoliRequest) (*rawatjalanpb.GetMasterTindakanByPoliResponse, error)
	GetMasterICD10ByPoli(ctx context.Context, req *rawatjalanpb.GetMasterICD10ByPoliRequest) (*rawatjalanpb.GetMasterICD10ByPoliResponse, error)
	GetMasterKBMsByPoli(ctx context.Context, req *rawatjalanpb.GetMasterKBMsByPoliRequest) (*rawatjalanpb.GetMasterKBMsByPoliResponse, error)
}

// PharmacyPort abstracts the pharmacy-service operations.
type PharmacyPort interface {
	CreatePrescription(ctx context.Context, req *pharmacypb.CreatePrescriptionRequest) (*pharmacypb.CreatePrescriptionResponse, error)
	DispensePrescription(ctx context.Context, req *pharmacypb.DispensePrescriptionRequest) (*pharmacypb.DispensePrescriptionResponse, error)
	GetMasterObat(ctx context.Context, req *pharmacypb.GetMasterObatRequest) (*pharmacypb.GetMasterObatResponse, error)
	GetMasterObatByPoli(ctx context.Context, req *pharmacypb.GetMasterObatByPoliRequest) (*pharmacypb.GetMasterObatByPoliResponse, error)
	GetMasterKFA(ctx context.Context, req *pharmacypb.GetMasterKFARequest) (*pharmacypb.GetMasterKFAResponse, error)
	GetMasterDPHO(ctx context.Context, req *pharmacypb.GetMasterDPHORequest) (*pharmacypb.GetMasterDPHOResponse, error)
	GetObatMappingDetails(ctx context.Context, req *pharmacypb.GetObatMappingDetailsRequest) (*pharmacypb.GetObatMappingDetailsResponse, error)
}

// BillingPort abstracts the billing-service operations.
type BillingPort interface {
	GetInvoicesByEncounter(ctx context.Context, req *billingpb.GetInvoicesByEncounterRequest) (*billingpb.GetInvoicesByEncounterResponse, error)
	GenerateInvoice(ctx context.Context, req *billingpb.GenerateInvoiceRequest) (*billingpb.GenerateInvoiceResponse, error)
	PayInvoice(ctx context.Context, req *billingpb.PayInvoiceRequest) (*billingpb.PayInvoiceResponse, error)
	CancelInvoice(ctx context.Context, req *billingpb.CancelInvoiceRequest) (*billingpb.CancelInvoiceResponse, error)
	AddRegistrationFee(ctx context.Context, req *billingpb.AddRegistrationFeeRequest) (*billingpb.AddRegistrationFeeResponse, error)
	GetActionPaymentStatus(ctx context.Context, req *billingpb.GetActionPaymentStatusRequest) (*billingpb.GetActionPaymentStatusResponse, error)
}

// ServicePorts groups all domain ports for use by handlers.
// Adding a new transport (e.g. message broker) only requires implementing the
// relevant interface and swapping it here in main.go — handlers stay unchanged.
type ServicePorts struct {
	Auth         AuthPort
	Patient      PatientPort
	Registration RegistrationPort
	EMR          EMRPort
	RawatJalan   RawatJalanPort
	Pharmacy     PharmacyPort
	Billing      BillingPort
}
