package queue

import (
	"context"
	"time"
)

type AgeBracket string

const (
	BracketBalita   AgeBracket = "Balita"      // 0-5
	BracketAnakAnak AgeBracket = "Anak-Anak"   // 6-17
	BracketDewasa   AgeBracket = "Dewasa"      // 18-59
	BracketLansia   AgeBracket = "Lansia"      // 60+
)

// GetAgeBracket determines the age bracket given an age in years
func GetAgeBracket(age int) AgeBracket {
	if age <= 5 {
		return BracketBalita
	}
	if age <= 17 {
		return BracketAnakAnak
	}
	if age <= 59 {
		return BracketDewasa
	}
	return BracketLansia
}

// ConsultationHistoryProvider represents a data source (e.g., database, gRPC client, Redis)
// that can return historical consultation averages.
type ConsultationHistoryProvider interface {
	// GetAverage returns the average consultation time and total record count.
	// Empty strings for ageBracket or gender mean "ignore this filter" (aggregate broader data).
	GetAverage(ctx context.Context, diagnosis string, ageBracket string, gender string) (avg time.Duration, count int, err error)
}

type AIQueueEstimator struct {
	provider            ConsultationHistoryProvider
	minThreshold        int
	defaultWaitTime     time.Duration
}

func NewAIQueueEstimator(provider ConsultationHistoryProvider, minThreshold int, defaultWaitTime time.Duration) *AIQueueEstimator {
	return &AIQueueEstimator{
		provider:            provider,
		minThreshold:        minThreshold,
		defaultWaitTime:     defaultWaitTime,
	}
}

// EstimateWaitTime estimates the wait time based on AI-ready Fallback Query logic.
// If diagnosis is empty (e.g. at registration), it can be used for broad department-level averages.
func (e *AIQueueEstimator) EstimateWaitTime(ctx context.Context, queuePosition int, key string, age int, gender string) time.Duration {
	if queuePosition <= 1 {
		return 0
	}

	bracket := string(GetAgeBracket(age))
	avgTime := e.defaultWaitTime

	// 1. Level 1 (Most Specific): Key (Diagnosis/Dept) + Age Bracket + Gender
	lvl1Avg, lvl1Count, err := e.provider.GetAverage(ctx, key, bracket, gender)
	if err == nil && lvl1Count >= e.minThreshold {
		avgTime = lvl1Avg
		return avgTime * time.Duration(queuePosition-1)
	}

	// 2. Level 2 (Broader): Key + Age Bracket
	lvl2Avg, lvl2Count, err := e.provider.GetAverage(ctx, key, bracket, "")
	if err == nil && lvl2Count >= e.minThreshold {
		avgTime = lvl2Avg
		return avgTime * time.Duration(queuePosition-1)
	}

	// 3. Level 3 (Broadest): Key only
	lvl3Avg, lvl3Count, err := e.provider.GetAverage(ctx, key, "", "")
	if err == nil && lvl3Count >= e.minThreshold {
		avgTime = lvl3Avg
		return avgTime * time.Duration(queuePosition-1)
	}

	// Fallback to default if no historical data is robust enough
	return e.defaultWaitTime * time.Duration(queuePosition-1)
}

// MockConsultationHistoryProvider is used for testing and when the actual DB view is not ready yet.
type MockConsultationHistoryProvider struct {
	// A mock map: key could be "Dept-Bracket-Gender" or similar
	MockData map[string]struct{
		Avg time.Duration
		Count int
	}
}

func (m *MockConsultationHistoryProvider) GetAverage(ctx context.Context, key string, ageBracket string, gender string) (time.Duration, int, error) {
	// For testing Fallback logic, we just return based on what is provided
	// E.g., if key == "Flu" and bracket == "Lansia" and gender == "Pria", we might have <10 records.
	
	if key == "Flu" && ageBracket == "Lansia" && gender == "Pria" {
		return 20 * time.Minute, 5, nil // < 10 records, should fallback
	}
	
	if key == "Flu" && ageBracket == "Lansia" && gender == "" {
		return 18 * time.Minute, 8, nil // still < 10 records, should fallback
	}
	
	if key == "Flu" && ageBracket == "" && gender == "" {
		return 15 * time.Minute, 50, nil // >= 10 records, SHOULD MATCH Level 3!
	}

	// For registration (Department proxy)
	if key == "IGD" {
		return 10 * time.Minute, 100, nil
	}

	return 0, 0, nil
}
