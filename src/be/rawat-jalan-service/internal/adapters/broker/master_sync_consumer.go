package broker

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"

	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/redis/go-redis/v9"
)

// ClinicalMasterSyncPayload defines the event payload for master data replication
type ClinicalMasterSyncPayload struct {
	EntityType string          `json:"entity_type"` // "ICD10", "KBM", "Tindakan"
	Action     string          `json:"action"`      // "UPSERT", "DELETE"
	Data       json.RawMessage `json:"data"`
}

type ICD10SyncData struct {
	Icd10Code   string `json:"icd10_code"`
	NameEn      string `json:"name_en"`
	NameID      string `json:"name_id"`
	ChapterCode string `json:"chapter_code"`
	BlockCode   string `json:"block_code"`
	IsActive    bool   `json:"is_active"`
	CodingRule  string `json:"coding_rule"`
}

type KBMSyncData struct {
	KbmCode     string `json:"kbm_code"`
	KbmName     string `json:"kbm_name"`
	Description string `json:"description"`
	BodySystem  string `json:"body_system"`
	IsActive    bool   `json:"is_active"`
}

type TindakanSyncData struct {
	KodeTindakan     string `json:"kode_tindakan"`
	NamaTindakan     string `json:"nama_tindakan"`
	BasePrice        string `json:"base_price"`
	IsActive         bool   `json:"is_active"`
	InternalCategory string `json:"internal_category"`
}

// NewClinicalMasterSyncConsumer listens to "clinical_master_stream" and replicates changes
// into rawat_jalan local read-replica tables (icd10_catalog, kbm_catalog, master_tindakan).
func NewClinicalMasterSyncConsumer(client *redis.Client, queries *db.Queries) *outbox.Consumer {
	handler := func(ctx context.Context, msg redis.XMessage) error {
		payloadStr, ok := msg.Values["payload"].(string)
		if !ok {
			slog.Warn("[Master Sync Consumer] payload missing or not a string", "msg_id", msg.ID)
			return nil
		}

		var payload ClinicalMasterSyncPayload
		if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
			slog.Error("[Master Sync Consumer] Failed to unmarshal sync payload", "msg_id", msg.ID, "error", err)
			return nil
		}

		slog.Info("[Master Sync Consumer] Processing master sync event",
			"entity", payload.EntityType,
			"action", payload.Action,
		)

		switch payload.EntityType {
		case "ICD10":
			var d ICD10SyncData
			if err := json.Unmarshal(payload.Data, &d); err != nil {
				slog.Error("[Master Sync Consumer] Failed to unmarshal ICD10 data", "error", err)
				return nil
			}
			if payload.Action == "DELETE" {
				return queries.SoftDeleteICD10Replica(ctx, d.Icd10Code)
			}
			return queries.UpsertICD10Replica(ctx, db.UpsertICD10ReplicaParams{
				Icd10Code:   d.Icd10Code,
				NameEn:      d.NameEn,
				NameID:      d.NameID,
				ChapterCode: sql.NullString{String: d.ChapterCode, Valid: d.ChapterCode != ""},
				BlockCode:   sql.NullString{String: d.BlockCode, Valid: d.BlockCode != ""},
				IsActive:    sql.NullBool{Bool: d.IsActive, Valid: true},
				CodingRule:  sql.NullString{String: d.CodingRule, Valid: d.CodingRule != ""},
			})

		case "KBM":
			var d KBMSyncData
			if err := json.Unmarshal(payload.Data, &d); err != nil {
				slog.Error("[Master Sync Consumer] Failed to unmarshal KBM data", "error", err)
				return nil
			}
			if payload.Action == "DELETE" {
				return queries.SoftDeleteKBMReplica(ctx, d.KbmCode)
			}
			return queries.UpsertKBMReplica(ctx, db.UpsertKBMReplicaParams{
				KbmCode:     d.KbmCode,
				KbmName:     d.KbmName,
				Description: sql.NullString{String: d.Description, Valid: d.Description != ""},
				BodySystem:  sql.NullString{String: d.BodySystem, Valid: d.BodySystem != ""},
				IsActive:    d.IsActive,
			})

		case "Tindakan":
			var d TindakanSyncData
			if err := json.Unmarshal(payload.Data, &d); err != nil {
				slog.Error("[Master Sync Consumer] Failed to unmarshal Tindakan data", "error", err)
				return nil
			}
			if payload.Action == "DELETE" {
				return queries.SoftDeleteTindakanReplica(ctx, d.KodeTindakan)
			}
			return queries.UpsertTindakanReplica(ctx, db.UpsertTindakanReplicaParams{
				KodeTindakan:     d.KodeTindakan,
				NamaTindakan:     d.NamaTindakan,
				BasePrice:        d.BasePrice,
				IsActive:         d.IsActive,
				InternalCategory: sql.NullString{String: d.InternalCategory, Valid: d.InternalCategory != ""},
			})

		default:
			slog.Warn("[Master Sync Consumer] Unrecognized entity type", "entity", payload.EntityType)
			return nil
		}
	}

	return outbox.NewConsumer(
		client,
		"clinical_master_stream",
		"rawat-jalan-master-sync",
		"rawat-jalan-master-sync-1",
		handler,
	)
}
