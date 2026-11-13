import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin','office','operator')", name="role_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16))
    active: Mapped[bool] = mapped_column(Boolean, server_default="true", default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CustomerModel(Base):
    __tablename__ = "customers"
    __table_args__ = (CheckConstraint("kind IN ('PF','PJ')", name="kind_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(2))
    document: Mapped[str] = mapped_column(String(14), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    trade_name: Mapped[str | None] = mapped_column(String(160))
    state_registration: Mapped[str | None] = mapped_column(String(30))
    municipal_registration: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(30))
    contact_name: Mapped[str | None] = mapped_column(String(120))
    zip_code: Mapped[str] = mapped_column(String(8))
    street: Mapped[str] = mapped_column(String(160))
    number: Mapped[str] = mapped_column(String(20))
    complement: Mapped[str | None] = mapped_column(String(80))
    district: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(2))
    ibge_city_code: Mapped[str | None] = mapped_column(String(7))
    notes: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, server_default="true", default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DrillRigModel(Base):
    __tablename__ = "drill_rigs"
    __table_args__ = (
        CheckConstraint("max_diameter_cm BETWEEN 20 AND 120", name="diameter_range"),
        CheckConstraint("max_depth_m > 0 AND max_depth_m <= 40", name="depth_range"),
        CheckConstraint("status IN ('active','maintenance','inactive')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    max_diameter_cm: Mapped[int]
    max_depth_m: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    status: Mapped[str] = mapped_column(String(12))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PriceTableModel(Base):
    __tablename__ = "price_table"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    mobilization_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    minimum_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    max_tabled_depth_m: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PriceTableItemModel(Base):
    __tablename__ = "price_table_items"

    diameter_cm: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    price_per_m: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class JobModel(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('planned','in_progress','completed','cancelled')", name="status_valid"
        ),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="dates_ordered",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    zip_code: Mapped[str] = mapped_column(String(8))
    street: Mapped[str] = mapped_column(String(160))
    number: Mapped[str] = mapped_column(String(20))
    complement: Mapped[str | None] = mapped_column(String(80))
    district: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(2))
    ibge_city_code: Mapped[str | None] = mapped_column(String(7))
    status: Mapped[str] = mapped_column(String(12))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    mobilization_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    minimum_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    max_tabled_depth_m: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class JobPriceModel(Base):
    __tablename__ = "job_prices"

    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    diameter_cm: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    price_per_m: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class JobRigModel(Base):
    __tablename__ = "job_rigs"

    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    rig_id: Mapped[int] = mapped_column(ForeignKey("drill_rigs.id"), primary_key=True)


class JobOperatorModel(Base):
    __tablename__ = "job_operators"

    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)


class MeasurementModel(Base):
    __tablename__ = "measurements"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','submitted','approved','rejected')", name="status_valid"
        ),
        Index("ix_measurements_job_id_status", "job_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_key: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    rig_id: Mapped[int] = mapped_column(ForeignKey("drill_rigs.id"))
    work_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    entered_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    photo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("photos.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PhotoModel(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    storage_key: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MeasurementLineModel(Base):
    __tablename__ = "measurement_lines"
    __table_args__ = (
        CheckConstraint("diameter_cm BETWEEN 20 AND 120", name="diameter_range"),
        CheckConstraint("depth_m > 0", name="depth_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    measurement_id: Mapped[int] = mapped_column(
        ForeignKey("measurements.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int]
    pile_code: Mapped[str] = mapped_column(String(20))
    diameter_cm: Mapped[int]
    depth_m: Mapped[Decimal] = mapped_column(Numeric(10, 2))


Index("uq_drill_rigs_lower_name", func.lower(DrillRigModel.name), unique=True)
